// La homepage: apertura, prodotti, perche' un broker, soci fondatori, societa', passi, preventivo.
import { Broker } from "../components/Broker";
import { Companies, Founders } from "../components/Founders";
import { Hero } from "../components/Hero";
import type { PageProps } from "../components/Layout";
import { Products } from "../components/Products";
import { Quote } from "../components/Quote";
import { Steps } from "../components/Steps";

export const Home = (props: PageProps) => (
  <>
    <Hero {...props} />
    <Products {...props} />
    <Broker {...props} />
    <Founders {...props} />
    <Companies {...props} />
    <Steps {...props} />
    <Quote {...props} />
  </>
);
