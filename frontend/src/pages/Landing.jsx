import { LandingNav } from '../components/landing/LandingNav.jsx';
import { Hero } from '../components/landing/Hero.jsx';
import { TechMarquee } from '../components/landing/TechMarquee.jsx';
import { Stats } from '../components/landing/Stats.jsx';
import { Features } from '../components/landing/Features.jsx';
import { ProductTour } from '../components/landing/ProductTour.jsx';
import { AiDemo } from '../components/landing/AiDemo.jsx';
import { HowItWorks } from '../components/landing/HowItWorks.jsx';
import { Trust } from '../components/landing/Trust.jsx';
import { Faq } from '../components/landing/Faq.jsx';
import { FinalCta } from '../components/landing/FinalCta.jsx';
import { Footer } from '../components/landing/Footer.jsx';
import { useDocumentTitle } from '../lib/hooks.js';

export default function Landing() {
  useDocumentTitle('Know how your team actually ships');
  return (
    <div className="min-h-dvh overflow-x-clip">
      <LandingNav />
      <main id="main">
        <Hero />
        <TechMarquee />
        <Stats />
        <Features />
        <ProductTour />
        <AiDemo />
        <HowItWorks />
        <Trust />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
