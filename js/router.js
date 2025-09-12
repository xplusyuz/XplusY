export const routes = {
  "": "home",
  "#home": "home",
  "#tests": "tests",
  "#live": "live",
  "#leaderboard": "leaderboard",
  "#settings": "settings",
  "#simulator": "simulator",
  "#profile": "profile"
};

export async function loadRoute(route){
  const name = routes[route] || "home";
  const res = await fetch(`/partials/${name}.html?ts=${Date.now()}`);
  if(!res.ok){ throw new Error(`Sahifa skriptini yuklashda xato: ${res.status}`); }
  const html = await res.text();
  return {name, html};
}
