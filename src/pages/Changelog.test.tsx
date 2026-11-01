import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./Changelog";

describe("Markdown link scheme", () => {
  it("renders an http(s) link as a real anchor", () => {
    render(<Markdown text="see [docs](https://example.com/x)" />);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("href", "https://example.com/x");
  });

  it("renders a site-relative link as a real anchor", () => {
    render(<Markdown text="see [settings](/settings)" />);
    const link = screen.getByRole("link", { name: "settings" });
    expect(link).toHaveAttribute("href", "/settings");
  });

  it("renders a javascript: link as plain text, not a clickable anchor", () => {
    const { container } = render(<Markdown text="click [here](javascript:alert(1))" />);
    expect(container).toHaveTextContent("click here");
    expect(container.querySelector("a")).toBeNull();
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("renders a protocol-relative link as plain text, not a clickable anchor", () => {
    const { container } = render(<Markdown text="click [here](//evil.example.com)" />);
    expect(container).toHaveTextContent("click here");
    expect(container.querySelector("a")).toBeNull();
  });

  it("still auto-links bare http(s) URLs", () => {
    render(<Markdown text="https://example.com/y" />);
    expect(screen.getByRole("link", { name: "https://example.com/y" })).toHaveAttribute(
      "href",
      "https://example.com/y",
    );
  });
});
