import ReactDOM from "react-dom";
import { App } from "./App";

const container = document.getElementById("app");
if (!container) throw new Error("");
ReactDOM.render(<App />, container);
