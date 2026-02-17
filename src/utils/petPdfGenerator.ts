import jsPDF from 'jspdf';

interface PetPolicyData {
  practiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  petName: string;
  petSpecies: string;
  petBreed?: string;
  petBirthDate: string;
  petGender: string;
  petWeight?: number;
  coverages: {
    rsv?: {
      type: string;
      maxAmount: string;
      deductible: string;
      description: string;
    };
    rct?: {
      type: string;
      maxAmount: string;
      waitingPeriod: string;
      description: string;
    };
    assistance: {
      included: boolean;
      description: string;
    };
    legalProtection?: {
      included: boolean;
      cost: string;
    };
  };
  premiumAnnual: string;
  premiumMonthly: string;
  policyStartDate?: string;
  policyEndDate?: string;
}

export const generatePetPolicyPDF = (data: PetPolicyData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper function to add text with automatic line wrapping
  const addText = (text: string, fontSize: number, isBold: boolean = false, align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    if (align === 'center') {
      doc.text(text, pageWidth / 2, yPosition, { align: 'center' });
    } else if (align === 'right') {
      doc.text(text, pageWidth - margin, yPosition, { align: 'right' });
    } else {
      const lines = doc.splitTextToSize(text, contentWidth);
      doc.text(lines, margin, yPosition);
      yPosition += (lines.length - 1) * (fontSize * 0.4);
    }
    yPosition += fontSize * 0.5;
  };

  const addSpace = (space: number = 5) => {
    yPosition += space;
  };

  const addLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;
  };

  // Header
  doc.setFillColor(41, 98, 255);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  addText('RIEPILOGO POLIZZA PET', 20, true, 'center');
  yPosition = 50;
  doc.setTextColor(0, 0, 0);

  addSpace(10);

  // Client Information
  addText('DATI CONTRAENTE', 12, true);
  addSpace(5);
  addText(`Nome: ${data.clientName}`, 10);
  addText(`Email: ${data.clientEmail}`, 10);
  addText(`Telefono: ${data.clientPhone}`, 10);
  addSpace(10);
  addLine();

  // Pet Information
  addText('DATI ANIMALE', 12, true);
  addSpace(5);
  addText(`Nome: ${data.petName}`, 10);
  addText(`Specie: ${data.petSpecies}`, 10);
  if (data.petBreed) {
    addText(`Razza: ${data.petBreed}`, 10);
  }
  addText(`Data di Nascita: ${new Date(data.petBirthDate).toLocaleDateString('it-IT')}`, 10);
  addText(`Sesso: ${data.petGender}`, 10);
  if (data.petWeight) {
    addText(`Peso: ${data.petWeight} kg`, 10);
  }
  addSpace(10);
  addLine();

  // Coverages
  addText('COPERTURE ASSICURATIVE', 12, true);
  addSpace(5);

  // Assistance (always included)
  doc.setFillColor(240, 248, 255);
  doc.rect(margin, yPosition, contentWidth, 15, 'F');
  yPosition += 5;
  addText('Assistenza Standard (Inclusa)', 10, true);
  addText(data.coverages.assistance.description, 9);
  addSpace(5);

  // RSV
  if (data.coverages.rsv) {
    doc.setFillColor(240, 255, 240);
    doc.rect(margin, yPosition, contentWidth, 20, 'F');
    yPosition += 5;
    addText(`Rimborso Spese Veterinarie - ${data.coverages.rsv.type}`, 10, true);
    addText(`Massimale: ${data.coverages.rsv.maxAmount}`, 9);
    addText(`Scoperto: ${data.coverages.rsv.deductible}`, 9);
    addText(data.coverages.rsv.description, 9);
    addSpace(5);
  }

  // RCT
  if (data.coverages.rct) {
    doc.setFillColor(255, 250, 240);
    doc.rect(margin, yPosition, contentWidth, 20, 'F');
    yPosition += 5;
    addText(`Responsabilita Civile verso Terzi - ${data.coverages.rct.type}`, 10, true);
    addText(`Massimale: ${data.coverages.rct.maxAmount}`, 9);
    addText(`Carenza: ${data.coverages.rct.waitingPeriod}`, 9);
    addText(data.coverages.rct.description, 9);
    addSpace(5);
  }

  // Legal Protection
  if (data.coverages.legalProtection?.included) {
    doc.setFillColor(255, 245, 245);
    doc.rect(margin, yPosition, contentWidth, 15, 'F');
    yPosition += 5;
    addText('Tutela Legale', 10, true);
    addText(`Costo aggiuntivo: ${data.coverages.legalProtection.cost}`, 9);
    addSpace(5);
  }

  addSpace(5);
  addLine();

  // Premium
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPosition, contentWidth, 25, 'F');
  yPosition += 8;
  addText('PREMIO ASSICURATIVO', 12, true);
  addSpace(3);
  addText(`Annuale: ${data.premiumAnnual}`, 11, true);
  addText(`Mensile: ${data.premiumMonthly}`, 10);
  addSpace(10);
  addLine();

  // Check if we need a new page
  if (yPosition > pageHeight - 100) {
    doc.addPage();
    yPosition = margin;
  }

  // Instructions
  addText('COME UTILIZZARE LE TUE COPERTURE', 12, true);
  addSpace(8);

  addText('Assistenza 24/7', 10, true);
  addText('Puoi contattare il servizio di assistenza in qualsiasi momento per emergenze veterinarie, consigli medici o per trovare strutture veterinarie convenzionate nella tua zona. Il servizio e sempre attivo e gratuito.', 9);
  addSpace(8);

  if (data.coverages.rsv) {
    addText('Rimborso Spese Veterinarie', 10, true);
    addText('Per richiedere un rimborso, conserva tutte le fatture e le ricevute delle spese veterinarie sostenute. Invia la documentazione completa entro 30 giorni dalla data della prestazione. Il rimborso verra erogato entro 15 giorni lavorativi dalla ricezione della documentazione completa. Ricorda che si applica lo scoperto indicato e il massimale annuale.', 9);
    addSpace(8);
  }

  if (data.coverages.rct) {
    addText('Responsabilita Civile verso Terzi', 10, true);
    addText('In caso di danni causati dal tuo animale a terze persone o cose, contatta immediatamente la compagnia assicurativa per aprire una denuncia di sinistro. Non ammettere responsabilita e non effettuare pagamenti diretti senza autorizzazione. La copertura e valida dopo il periodo di carenza indicato.', 9);
    addSpace(8);
  }

  addText('Documentazione Necessaria', 10, true);
  addText('Per qualsiasi richiesta di rimborso o assistenza, tieni sempre a portata di mano il numero di polizza, il libretto sanitario del tuo animale aggiornato e la documentazione delle spese sostenute. Assicurati che tutte le fatture siano intestate al contraente della polizza.', 9);
  addSpace(8);

  addText('Rinnovo e Disdetta', 10, true);
  addText('La polizza si rinnova automaticamente alla scadenza. Per esercitare il diritto di disdetta, invia una comunicazione scritta almeno 30 giorni prima della data di scadenza. Il mancato pagamento del premio comporta la sospensione della copertura assicurativa.', 9);

  // Footer
  yPosition = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Documento generato automaticamente - Conservare con cura', pageWidth / 2, yPosition, { align: 'center' });
  doc.text(`Data generazione: ${new Date().toLocaleDateString('it-IT')}`, pageWidth / 2, yPosition + 5, { align: 'center' });

  return doc;
};
