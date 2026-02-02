import asyncio
import logging
import os
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, AutoSubscribe
from livekit.plugins import deepgram, cartesia, silero
from dotenv import load_dotenv
import anthropic as anthropic_sdk

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-agent")

current_tts_task = None

# PROMPT OTTIMIZZATO PER IL RILEVAMENTO "SINTATTICO"
SYSTEM_PROMPT = """
Sei un assistente vocale avanzato.
Parli perfettamente Italiano, Inglese e Spagnolo.

REGOLA DI COMPORTAMENTO:
1. Ascolta l'input dell'utente.
2. Rileva la lingua in cui è scritto/pronunciato.
3. Rispondi SEMPRE nella stessa lingua dell'utente.

IMPORTANTE:
L'input potrebbe contenere errori fonetici (es. inglese scritto come italiano).
Cerca di interpretare il senso e rispondi coerentemente.

Esempi:
- Input: "Ciao come stai?" -> Rispondi in Italiano.
- Input: "Hello how are you" -> Rispondi in Inglese.
- Input: "Hola que tal" -> Rispondi in Spagnolo.

Sii breve (1-2 frasi) e naturale.
"""


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f"Connesso a {ctx.room.name}")

    participant = await ctx.wait_for_participant()

    # 1. VAD (Silenzio)
    vad = silero.VAD.load()

    # 2. STT (Orecchio) - IMPOSTATO SU ITALIANO (Nova-2 veloce e stabile)
    # Questo evita che "Ciao" diventi "Chow".
    stt = deepgram.STT(model="nova-2", language="it")

    # 3. TTS (Bocca) - Cartesia Multilingua
    tts = cartesia.TTS(
        model="sonic-multilingual",
        voice="248be419-3632-4f38-b500-07e78518219c",
    )

    source = rtc.AudioSource(24000, 1)
    track = rtc.LocalAudioTrack.create_audio_track("agent-voice", source)
    await ctx.room.local_participant.publish_track(track)

    messages = []

    logger.info("Saluto iniziale...")
    await speak(source, tts, "Ciao! Sono pronto. Parliamo.")

    # Loop di ascolto per ogni traccia audio
    for publication in participant.track_publications.values():
        if publication.track and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info("In ascolto...")
            asyncio.create_task(
                listen_loop(publication.track, source, vad, stt, tts, messages)
            )

    await asyncio.Event().wait()


async def listen_loop(track, source, vad, stt, tts, messages):
    audio_stream = rtc.AudioStream(track)
    stt_stream = stt.stream()
    vad_stream = vad.stream()

    async def process_speech():
        async for event in stt_stream:
            if hasattr(event, "alternatives") and event.alternatives:
                user_text = event.alternatives[0].text.strip()
                if user_text and len(user_text) > 2:
                    logger.info(f"Utente: {user_text}")
                    await respond(user_text, source, tts, messages)

    asyncio.create_task(process_speech())

    async for audio_event in audio_stream:
        stt_stream.push_frame(audio_event.frame)
        vad_stream.push_frame(audio_event.frame)

        # Interruzione (Barge-in)
        async for vad_event in vad_stream:
            if vad_event.type == silero.VADEventType.START_OF_SPEECH:
                global current_tts_task
                if current_tts_task and not current_tts_task.done():
                    logger.info("Interruzione rilevata")
                    current_tts_task.cancel()


async def speak(source, tts, text):
    global current_tts_task

    async def _speak():
        try:
            async for audio in tts.synthesize(text):
                await source.capture_frame(audio.frame)
        except asyncio.CancelledError:
            pass

    current_tts_task = asyncio.create_task(_speak())
    try:
        await current_tts_task
    except asyncio.CancelledError:
        pass


async def respond(user_text, source, tts, messages):
    global current_tts_task
    if current_tts_task and not current_tts_task.done():
        current_tts_task.cancel()

    messages.append({"role": "user", "content": user_text})

    client = anthropic_sdk.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    response = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=150,
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    response_text = response.content[0].text
    messages.append({"role": "assistant", "content": response_text})
    logger.info(f"AI: {response_text}")

    await speak(source, tts, response_text)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
