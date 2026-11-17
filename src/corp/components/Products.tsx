// I prodotti: una lastra di vetro per ciascuno, i sei piu' richiesti per primi e piu' grandi. Ogni lastra porta alla
// richiesta di preventivo con il prodotto gia' scelto; le fideiussioni rimandano al portale per le VIES.
import { ArrowRight, ArrowUpRight, Briefcase, Building2, Car, Construction, HeartPulse, Home, PawPrint, Scale, ShieldCheck, Store, Sun, type LucideIcon } from "lucide-react";
import { PORTAL_URL } from "../config";
import { PRODUCT_IDS, isFeatured, type ProductId } from "../products";
import { SectionHead, type PageProps } from "./Layout";

const ICONS: Record<ProductId, LucideIcon> = {
  fideiussioni: ShieldCheck,
  car: Construction,
  "decennale-postuma": Building2,
  "rc-professionale": Briefcase,
  "d-and-o": Scale,
  pet: PawPrint,
  fotovoltaico: Sun,
  "impresa-commercio": Store,
  casa: Home,
  auto: Car,
  "infortuni-malattia": HeartPulse,
};

export const Products = ({ content }: PageProps) => {
  const { products } = content.home;
  return (
    <section className="section products" id="prodotti" aria-labelledby="prodotti-titolo">
      <div className="container">
        <SectionHead title={products.title} id="prodotti-titolo" />
        <div className="products__grid">
          {PRODUCT_IDS.map((id) => {
            const Icon = ICONS[id];
            const item = products.items[id];
            return (
              <article key={id} className={`product-card${isFeatured(id) ? " product-card--featured" : ""} glass-card`} data-product={id} data-glow data-reveal>
                <span className="product-card__icon" aria-hidden="true">
                  <Icon size={24} strokeWidth={1.6} />
                </span>
                <h3 className="product-card__name">{item.name}</h3>
                <p className="product-card__line">{item.line}</p>
                {id === "fideiussioni" ? (
                  <a className="product-card__link" href={PORTAL_URL}>
                    {products.viesLink}
                    <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
                  </a>
                ) : null}
                <a className="product-card__quote" href="#preventivo" data-quote-product={id}>
                  {products.quote}
                  <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
