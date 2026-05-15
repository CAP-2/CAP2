import { useLanguage } from "../../i18n/LanguageContext";
import "./LanguageToggle.css";

export default function LanguageToggle({ className = "" }) {
  const { language, toggleLanguage } = useLanguage();
  const nextLabel = language === "vi" ? "English" : "Tiếng Việt";

  return (
    <button
      type="button"
      className={`language-toggle ${className}`.trim()}
      onClick={toggleLanguage}
      title={`Đổi ngôn ngữ: ${nextLabel}`}
      aria-label={`Đổi ngôn ngữ: ${nextLabel}`}
      data-no-translate="true"
    >
      <span className="material-symbols-outlined">translate</span>
      <strong>{language === "vi" ? "VI" : "EN"}</strong>
    </button>
  );
}

