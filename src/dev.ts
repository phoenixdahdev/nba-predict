import app from "./index";

app.listen(process.env.PORT ?? 3000);

console.log(
  `🏀 NBA Predict running at http://${app.server?.hostname}:${app.server?.port}`
);
