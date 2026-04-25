import HeroBanner from "./HeroBanner";
import AboutSection from "./AboutSection";
import GenealogySection from "../Manager/GenealogySection";
import FeaturesSection from "./FeaturesSection";
import StatsSection from "./StatsSection";

export default function Home() {
  return (
    <>
      <HeroBanner />
      <section id="ve-chung-toi">
        <AboutSection />
      </section>
      <section id="loi-ich">
        <GenealogySection showAdmin={false} />
      </section>
      <section id="tin-tuc">
        <FeaturesSection />
      </section>
      <section id="huong-dan">
        <StatsSection />
      </section>
    </>
  );
}
