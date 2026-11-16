// La homepage: apertura, prodotti, perche' un broker, soci fondatori, societa', passi, preventivo.
import { Broker } from "../components/Broker";
import { Companies, Founders } from "../components/Founders";
import { Hero } from "../components/Hero";
import type { PageProps } from "../components/Layout";
import { Products } from "../components/Products";
import { Quote } from "../components/Quote";
import { Steps } from "../components/Steps";

/** `contactEndpoint`: l'indirizzo a cui il modulo di preventivo invia la richiesta. */
export const Home = ({ contactEndpoint, ...props }: PageProps & { contactEndpoint: string }) => (
  <>
    <Hero {...props} />
    <Products {...props} />
    <Broker {...props} />
    <Founders {...props} />
    <Companies {...props} />
    <Steps {...props} />
    <Quote {...props} endpoint={contactEndpoint} />
  </>
);
