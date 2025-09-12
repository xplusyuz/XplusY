
export const routeMap = {
  "": "home",
  "#home": "home",
  "#tests": "tests",
  "#live": "live",
  "#simulator": "simulator",
  "#leaderboard": "leaderboard",
  "#settings": "settings",
  "#profile": "profile",
};

export async function loadPartial(routeHash){
  const name = routeMap[routeHash] ?? "home";
  const res = await fetch(`/partials/${name}.html?ts=${Date.now()}`);
  if(!res.ok) throw new Error(`Sahifa skriptini yuklashda xato: ${res.status}`);
  return { name, html: await res.text() };
}
