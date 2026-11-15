// La homepage: le sezioni nell'ordine del progetto (§6.2).
import { Audiences } from "../components/Audiences";
import { Contact } from "../components/Contact";
import { Cost } from "../components/Cost";
import { Documents } from "../components/Documents";
import { Faq } from "../components/Faq";
import { Hero } from "../components/Hero";
import type { PageProps } from "../components/Layout";
import { PortalShowcase } from "../components/PortalShowcase";
import { Steps } from "../components/Steps";
import { TrustStrip } from "../components/TrustStrip";
import { WhatIs } from "../components/WhatIs";

export const Home = (props: PageProps) => (
  <>
    <Hero {...props} />
    <TrustStrip {...props} />
    <WhatIs {...props} />
    <Audiences {...props} />
    <Steps {...props} />
    <PortalShowcase {...props} />
    <Documents {...props} />
    <Cost {...props} />
    <Faq {...props} />
    <Contact {...props} />
  </>
);
