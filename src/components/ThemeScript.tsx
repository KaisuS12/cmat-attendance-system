export const THEME_KEY = "nam-theme";

// Runs before the first paint, so dark-mode users never see a white flash:
// the saved choice, otherwise the phone's or computer's own setting.
const SET_THEME = `(function(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SET_THEME }} />;
}
