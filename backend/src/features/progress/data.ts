import { activities } from "../../data/store";

export const progressUpdates = () => activities.filter((activity) => activity.kind === "progress");
export { activities };
