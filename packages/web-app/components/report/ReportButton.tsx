"use client"

import { PDFDownloadLink } from "@react-pdf/renderer"

import { ReportDocument } from "@/components/report/ReportDocument"
import { buttonVariants } from "@/components/ui/button"
import { COMPANY, DISCLAIMER } from "@/lib/constants"
import type { CalculationResult, ReportData } from "@/lib/types-bridge"

function fileNameForResult(result: CalculationResult) {
  const project = result.input.projectName.trim().replace(/\s+/g, "_") || "projekt"
  const date = result.input.date || new Date().toISOString().slice(0, 10)

  return `report_${project}_${date}.pdf`
}

export function ReportButton({ result }: { result: CalculationResult | null }) {
  if (!result) {
    return (
      <div
        className={buttonVariants({
          variant: "outline",
          className: "w-full cursor-not-allowed opacity-50",
        })}
      >
        PDF-Report nach Berechnung
      </div>
    )
  }

  const data: ReportData = {
    result,
    config: {
      companyName: COMPANY.name,
      companyAddress: COMPANY.address,
      disclaimer: DISCLAIMER,
      signatureName: result.input.preparedBy || "Verantwortliche Person",
    },
  }

  return (
    <PDFDownloadLink
      document={<ReportDocument data={data} />}
      fileName={fileNameForResult(result)}
      className={buttonVariants({
        variant: "outline",
        className: "w-full",
      })}
    >
      {({ loading }) => (loading ? "PDF wird vorbereitet..." : "PDF-Report herunterladen")}
    </PDFDownloadLink>
  )
}
