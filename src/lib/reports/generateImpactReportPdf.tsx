import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { ImpactReportDocument, type ImpactReportData } from "./ImpactReportDocument";

export async function generateImpactReportPdf(data: ImpactReportData): Promise<Buffer> {
  return renderToBuffer(<ImpactReportDocument data={data} />);
}
