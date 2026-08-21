import { ingest } from "../src/lib/ingest";
import { join } from "node:path";

const destDir = join(process.cwd(), "data");

ingest(destDir)
  .then(() => {
    console.log("Ingestion completed successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Ingestion failed:", err);
    process.exit(1);
  });
