import { screen } from "@testing-library/react";
import { ClientCell, ClientNameText, clientNames } from "@/components/shared/cells";
import { formatPhone } from "@/lib/format";
import { renderWithProviders } from "@/test/utils";

const AR = "أحمد الشريف";
const EN = "Ahmed Al-Sharif";

describe("clientNames", () => {
  it("leads with the Arabic name for an Arabic reader", () => {
    expect(clientNames(AR, EN, "ar")).toEqual({
      primary: AR,
      secondary: EN,
      primaryLang: "ar",
      secondaryLang: "en",
    });
  });

  it("leads with the Latin name for an English reader", () => {
    expect(clientNames(AR, EN, "en")).toEqual({
      primary: EN,
      secondary: AR,
      primaryLang: "en",
      secondaryLang: "ar",
    });
  });

  it("stands the Arabic name alone when the KYC record has no Latin form", () => {
    // Either locale: a missing name is never rendered as a gap or a dash.
    expect(clientNames(AR, null, "en")).toEqual({
      primary: AR,
      secondary: null,
      primaryLang: "ar",
      secondaryLang: "en",
    });
    expect(clientNames(AR, undefined, "ar")).toEqual({
      primary: AR,
      secondary: null,
      primaryLang: "ar",
      secondaryLang: "en",
    });
  });

  /**
   * Every register cell, drawer title, search result and export cell comes
   * through this function, which is why the directional-override defence lives
   * here rather than at each call site.
   */
  it("neutralises a directional override in either name", () => {
    expect(clientNames(`${AR}‮`, `${EN}‮`, "ar")).toEqual({
      primary: AR,
      secondary: EN,
      primaryLang: "ar",
      secondaryLang: "en",
    });
  });
});

describe("ClientCell", () => {
  it("shows both names, the reading locale's first", () => {
    renderWithProviders(
      <ClientCell name={AR} nameEn={EN} phone="0910000000" />,
      { locale: "en" },
    );

    const [first, second] = screen.getAllByText(/Sharif|الشريف/);
    expect(first).toHaveTextContent(EN);
    expect(second).toHaveTextContent(AR);
  });

  it("keeps its second line when only one name is on file", () => {
    renderWithProviders(<ClientCell name={AR} nameEn={null} phone="0910000000" />);

    expect(screen.getByText(AR)).toBeInTheDocument();
    // The phone still occupies the muted line, so row heights stay even.
    expect(screen.getByText(formatPhone("0910000000"))).toBeInTheDocument();
  });
});

describe("ClientNameText", () => {
  it("parenthesises the other name on one line", () => {
    renderWithProviders(<ClientNameText name={AR} nameEn={EN} />);

    expect(screen.getByText(AR)).toBeInTheDocument();
    expect(screen.getByText(`(${EN})`)).toBeInTheDocument();
  });

  it("declares the language of each name", () => {
    // WCAG 3.1.2. Without this a reader on an Arabic page pronounces the Latin
    // name with Arabic phonemes, and the operator hears a name that does not
    // match the document in their hand.
    renderWithProviders(<ClientNameText name={AR} nameEn={EN} />);

    expect(screen.getByText(AR)).toHaveAttribute("lang", "ar");
    expect(screen.getByText(`(${EN})`)).toHaveAttribute("lang", "en");
  });
});
