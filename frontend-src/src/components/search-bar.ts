import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { sharedStyles } from "../styles";

@customElement("wine-search-bar")
export class WineSearchBar extends LitElement {
  @property({ type: String }) value = "";
  @state() private _filter = "all";

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        /* the component was 80px wider than its column on a phone, which was
           what made the whole page scroll sideways */
        max-width: 100%;
        min-width: 0;
      }

      .search-container {
        display: flex;
        flex-wrap: wrap;
        gap: var(--wc-sp-2);
        padding: 0 var(--wc-sp-4) var(--wc-sp-2);
        align-items: center;
        min-width: 0;
      }
      /* the input keeps the row; the type chips wrap beneath it and scroll
         rather than pushing the page wider */
      .search-container > .search-input-wrapper {
        flex: 1 1 190px;
        min-width: 0;
      }
      .search-container > .filter-chips {
        flex: 1 1 auto;
        min-width: 0;
        max-width: 100%;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .search-container > .filter-chips::-webkit-scrollbar {
        display: none;
      }
      .search-container > .filter-chips > * {
        flex: 0 0 auto;
      }

      .search-input-wrapper {
        flex: 1;
        position: relative;
      }

      .search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--wc-text-secondary);
        font-size: var(--wc-fs-md);
        pointer-events: none;
      }

      input {
        width: 100%;
        padding: 8px 12px 8px 32px;
        border: 1px solid var(--wc-border);
        border-radius: var(--wc-r-pill);
        font-size: var(--wc-fs-md);
        background: var(--wc-bg);
        color: var(--wc-text);
        box-sizing: border-box;
        transition: border-color 0.2s;
      }

      input:focus {
        border-color: var(--wc-primary);
        outline: none;
      }

      .filter-chips {
        display: flex;
        gap: 4px;
      }

      .chip {
        padding: 4px 10px;
        border-radius: var(--wc-r-lg);
        border: 1px solid var(--wc-border);
        background: transparent;
        color: var(--wc-text-secondary);
        cursor: pointer;
        font-size: var(--wc-fs-xs);
        transition: all 0.2s;
        white-space: nowrap;
      }

      .chip:hover {
        background: rgba(114, 47, 55, 0.08);
      }

      .chip.active {
        background: var(--wc-primary);
        color: #fff;
        border-color: var(--wc-primary);
      }
    `,
  ];

  private _onInput(e: InputEvent) {
    const value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(
      new CustomEvent("search-change", {
        detail: { query: value, filter: this._filter },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onFilterChange(filter: string) {
    this._filter = filter;
    const input = this.shadowRoot?.querySelector("input") as HTMLInputElement;
    this.dispatchEvent(
      new CustomEvent("search-change", {
        detail: { query: input?.value || "", filter },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const filters = [
      { id: "all", label: "All" },
      { id: "red", label: "Red" },
      { id: "white", label: "White" },
      { id: "rosé", label: "Rosé" },
      { id: "sparkling", label: "Sparkling" },
      { id: "dessert", label: "Dessert" },
    ];

    return html`
      <div class="search-container">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search wines..."
            .value=${this.value}
            @input=${this._onInput}
          />
        </div>
        <div class="filter-chips">
          ${filters.map(
            (f) => html`
              <button
                class="chip ${this._filter === f.id ? "active" : ""}"
                @click=${() => this._onFilterChange(f.id)}
              >
                ${f.label}
              </button>
            `
          )}
        </div>
      </div>
    `;
  }
}
