import { jsPDF } from "jspdf";
import { NextResponse } from "next/server";

// Server-side PDF generation for the full astrology report.
// POST /api/generate-pdf
// Body: { name, dateOfBirth, timeOfBirth, placeOfBirth, reportId, summary, sections, chartData }
// Returns: PDF as base64 string
export const maxDuration = 30;

export async function POST(request) {
  try {
    const { name, dateOfBirth, timeOfBirth, placeOfBirth, reportId, summary, sections, chartData } =
      await request.json();

    if (!name || !sections || sections.length === 0) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Helper: add new page if needed
    const checkPage = (needed = 20) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // ===== TITLE PAGE =====
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setTextColor(167, 139, 250);
    doc.setFontSize(28);
    doc.text("BhavishAI", pageWidth / 2, 50, { align: "center" });
    doc.setFontSize(12);
    doc.setTextColor(200, 200, 200);
    doc.text("AI-Powered Vedic Astrology Report", pageWidth / 2, 62, { align: "center" });
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(name, pageWidth / 2, 100, { align: "center" });
    doc.setFontSize(11);
    doc.setTextColor(180, 180, 180);
    doc.text(`Date of Birth: ${new Date(dateOfBirth).toLocaleDateString("en-IN")}`, pageWidth / 2, 115, { align: "center" });
    doc.text(`Time: ${timeOfBirth} | Place: ${placeOfBirth}`, pageWidth / 2, 123, { align: "center" });
    doc.text(`Report ID: ${reportId}`, pageWidth / 2, 135, { align: "center" });
    doc.setTextColor(167, 139, 250);
    doc.setFontSize(10);
    doc.text("bhavishai.in", pageWidth / 2, pageHeight - 20, { align: "center" });

    // ===== SUMMARY PAGE =====
    doc.addPage();
    y = margin;
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setTextColor(124, 58, 237);
    doc.setFontSize(16);
    doc.text("Chart Summary", margin, y);
    y += 10;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(11);
    const summaryLines = doc.splitTextToSize(summary || "", contentWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 6 + 15;

    // ===== PLANETARY POSITIONS TABLE =====
    if (chartData && chartData.planets) {
      checkPage(60);
      doc.setTextColor(124, 58, 237);
      doc.setFontSize(14);
      doc.text("Planetary Positions (Swiss Ephemeris)", margin, y);
      y += 8;

      // Table header
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Planet", margin, y);
      doc.text("Sign", margin + 30, y);
      doc.text("Degree", margin + 75, y);
      doc.text("House", margin + 105, y);
      doc.text("Dignity", margin + 125, y);
      y += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      // Ascendant row
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(9);
      doc.text("Lagna", margin, y);
      doc.text(chartData.ascendant?.sign || "", margin + 30, y);
      doc.text(chartData.ascendant?.degree || "", margin + 75, y);
      doc.text("1st", margin + 105, y);
      y += 5;

      // Planet rows
      const planetOrder = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
      doc.setTextColor(60, 60, 60);
      for (const planet of planetOrder) {
        const data = chartData.planets[planet];
        if (!data) continue;
        checkPage(6);
        doc.text(planet, margin, y);
        doc.text(data.sign || "", margin + 30, y);
        doc.text(data.degree || "", margin + 75, y);
        doc.text(String(data.house || ""), margin + 105, y);
        doc.text(data.dignity || "Normal", margin + 125, y);
        y += 5;
      }
      y += 10;
    }

    // ===== NAKSHATRA INFO =====
    if (chartData && chartData.nakshatra) {
      checkPage(25);
      doc.setTextColor(124, 58, 237);
      doc.setFontSize(12);
      doc.text("Birth Star (Nakshatra)", margin, y);
      y += 7;
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.text(`Nakshatra: ${chartData.nakshatra.name} (Pada ${chartData.nakshatra.pada})`, margin, y);
      y += 5;
      doc.text(`Ruler: ${chartData.nakshatra.ruler} | Deity: ${chartData.nakshatra.deity || ""}`, margin, y);
      y += 5;
      doc.text(`Rashi (Moon Sign): ${chartData.rashi || ""}`, margin, y);
      y += 10;
    }

    // ===== LUCKY FACTORS =====
    if (chartData && chartData.ascendant) {
      const signGems = {
        1: { gem: "Red Coral", lucky: "9, 1, 3", day: "Tuesday", color: "Red" },
        2: { gem: "Diamond", lucky: "6, 2, 7", day: "Friday", color: "White" },
        3: { gem: "Emerald", lucky: "5, 3, 8", day: "Wednesday", color: "Green" },
        4: { gem: "Pearl", lucky: "2, 7, 9", day: "Monday", color: "White/Silver" },
        5: { gem: "Ruby", lucky: "1, 4, 9", day: "Sunday", color: "Gold/Orange" },
        6: { gem: "Emerald", lucky: "5, 3, 6", day: "Wednesday", color: "Green" },
        7: { gem: "Diamond", lucky: "6, 7, 2", day: "Friday", color: "White/Pink" },
        8: { gem: "Red Coral", lucky: "9, 1, 8", day: "Tuesday", color: "Dark Red" },
        9: { gem: "Yellow Sapphire", lucky: "3, 9, 5", day: "Thursday", color: "Yellow" },
        10: { gem: "Blue Sapphire", lucky: "8, 4, 6", day: "Saturday", color: "Blue/Black" },
        11: { gem: "Blue Sapphire", lucky: "8, 4, 7", day: "Saturday", color: "Blue" },
        12: { gem: "Yellow Sapphire", lucky: "3, 9, 7", day: "Thursday", color: "Yellow" },
      };
      const signIdx = chartData.ascendant.signIndex || 1;
      const lucky = signGems[signIdx] || signGems[1];

      checkPage(30);
      doc.setTextColor(124, 58, 237);
      doc.setFontSize(12);
      doc.text("Lucky Factors", margin, y);
      y += 7;
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.text(`Lucky Gemstone: ${lucky.gem}`, margin, y); y += 5;
      doc.text(`Lucky Color: ${lucky.color}`, margin, y); y += 5;
      doc.text(`Lucky Numbers: ${lucky.lucky}`, margin, y); y += 5;
      doc.text(`Lucky Day: ${lucky.day}`, margin, y); y += 10;
    }

    // ===== DASHA SEQUENCE =====
    if (chartData && chartData.dasha && chartData.dasha.length > 0) {
      checkPage(40);
      doc.setTextColor(124, 58, 237);
      doc.setFontSize(12);
      doc.text("Vimshottari Dasha Sequence", margin, y);
      y += 7;
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      for (const d of chartData.dasha) {
        checkPage(6);
        doc.text(`${d.planet} Mahadasha: ${d.years} years`, margin, y);
        y += 5;
      }
      y += 10;
    }

    // ===== ALL REPORT SECTIONS =====
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      checkPage(40);

      // Section header
      doc.setFillColor(245, 245, 255);
      doc.roundedRect(margin - 2, y - 4, contentWidth + 4, 12, 2, 2, "F");
      doc.setTextColor(124, 58, 237);
      doc.setFontSize(13);
      const title = `${i + 1}. ${(section.title || "").replace(/^\d+\.\s*/, "")}`;
      doc.text(title, margin, y + 4);
      y += 16;

      // Section content
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(section.content || "", contentWidth);
      for (const line of lines) {
        checkPage(7);
        doc.text(line, margin, y);
        y += 5.5;
      }
      y += 10;
    }

    // Footer on last page
    checkPage(20);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text(
      "Generated by BhavishAI | bhavishai.in | Powered by Swiss Ephemeris calculations.",
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    // Return as base64
    const pdfBase64 = doc.output("datauristring").split(",")[1];

    return NextResponse.json({ success: true, pdf: pdfBase64 });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
