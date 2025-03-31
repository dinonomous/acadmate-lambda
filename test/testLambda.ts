import { handler } from "../index";

(async () => {
  try {
    await handler();
    console.log("Lambda function executed successfully.");
  } catch (error) {
    console.error("Lambda function execution failed:", error);
  }
})();
