// ====================================================================
// SIMON42 DASHBOARD STRATEGY - EDITOR PANEL: ENTITY NAME RULES
// ====================================================================
// Row editor for `entity_name_rules`. Each row is a regex find/replace
// applied to generated entity display names. Invalid patterns are shown
// inline and still saved, so typing is not blocked.
// ====================================================================

/* eslint-disable xss/no-mixed-html, @typescript-eslint/no-confusing-void-expression --
   False positive: lit-html's `html` tag escapes every interpolation by
   construction. Codacy's legacy ESLint 8 engine misreads lit render
   functions, DOM Element locals and input event payloads as raw HTML. The
   void-expression rule fights the codebase's established concise event-
   handler arrows (`(checked) => host._toggleChanged(...)`). */
import { html, nothing, type TemplateResult } from 'lit';
import type { EntityNameRule, Simon42StrategyConfig } from '../../types/strategy';
import { localize } from '../../utils/localize';
import { applyEntityNameRules, entityNameRuleError } from '../../utils/name-utils';
import { stateFor } from '../entity-options';
import type { StrategyEditorHost } from '../editor-host';

const PREVIEW_LIMIT = 8;

interface NamePreview {
  entityId: string;
  before: string;
  after: string;
}

function domainOf(entityId: string): string {
  const dot = entityId.indexOf('.');
  return dot === -1 ? '' : entityId.slice(0, dot);
}

function parseDomains(raw: string): string[] | undefined {
  const parts: string[] = [];
  for (const piece of raw.split(',')) {
    const domain = piece.trim().toLowerCase();
    if (domain.length > 0) parts.push(domain);
  }
  return parts.length > 0 ? parts : undefined;
}

function formatDomains(domains: string[] | undefined): string {
  if (!domains || domains.length === 0) return '';
  return domains.join(', ');
}

function copyRule(
  rule: EntityNameRule,
  patch: {
    pattern?: string;
    replace?: string | null;
    flags?: string | null;
    domains?: string[] | null;
  }
): EntityNameRule {
  const next: EntityNameRule = {
    pattern: patch.pattern !== undefined ? patch.pattern : rule.pattern,
  };
  const replace = patch.replace !== undefined ? patch.replace : rule.replace;
  if (typeof replace === 'string' && replace.length > 0) next.replace = replace;
  const flags = patch.flags !== undefined ? patch.flags : rule.flags;
  if (typeof flags === 'string' && flags.length > 0) next.flags = flags;
  const domains = patch.domains !== undefined ? patch.domains : rule.domains;
  if (Array.isArray(domains) && domains.length > 0) next.domains = domains;
  return next;
}

function writeRules(host: StrategyEditorHost, rules: EntityNameRule[]): void {
  const newConfig: Simon42StrategyConfig = { ...host._config };
  if (rules.length > 0) {
    newConfig.entity_name_rules = rules;
  } else {
    delete newConfig.entity_name_rules;
  }
  host._config = newConfig;
  host._fireConfigChanged(newConfig);
}

function addEntityNameRule(host: StrategyEditorHost): void {
  const current = host._config.entity_name_rules || [];
  writeRules(host, [...current, { pattern: '' }]);
}

function removeEntityNameRule(host: StrategyEditorHost, index: number): void {
  const current = host._config.entity_name_rules || [];
  if (index < 0 || index >= current.length) return;
  writeRules(host, [...current.slice(0, index), ...current.slice(index + 1)]);
}

function replaceEntityNameRule(host: StrategyEditorHost, index: number, rule: EntityNameRule): void {
  const current = host._config.entity_name_rules || [];
  if (index < 0 || index >= current.length) return;
  const next = [...current];
  next.splice(index, 1, rule);
  writeRules(host, next);
}

function inputValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement ? target.value : '';
}

function ruleProblemText(rule: EntityNameRule): string | undefined {
  const problem = entityNameRuleError(rule.pattern, rule.flags);
  if (!problem) return undefined;
  if (problem.code === 'too_long') return localize('editor.entity_names_too_long');
  if (problem.code === 'bad_flags') return localize('editor.entity_names_bad_flags');
  const detail = problem.detail ? `: ${problem.detail}` : '';
  return `${localize('editor.entity_names_invalid')}${detail}`;
}

function previewChanges(host: StrategyEditorHost, rules: EntityNameRule[]): NamePreview[] {
  const hass = host._hass;
  if (!hass || rules.length === 0) return [];
  const out: NamePreview[] = [];
  for (const entityId of Object.keys(hass.states)) {
    if (out.length >= PREVIEW_LIMIT) break;
    const friendly = stateFor(hass, entityId)?.attributes?.friendly_name;
    if (typeof friendly !== 'string' || friendly.length === 0) continue;
    const after = applyEntityNameRules(friendly, rules, domainOf(entityId));
    if (after === friendly) continue;
    out.push({ entityId, before: friendly, after });
  }
  return out;
}

export function renderEntityNamesSection(host: StrategyEditorHost): TemplateResult {
  const rules = host._config.entity_name_rules || [];
  const preview = previewChanges(host, rules);

  return html`
    <div class="description" style="margin-left: 0; margin-bottom: 12px;">
      ${localize('editor.entity_names_desc')}
    </div>

    <div id="entity-name-rules-list" style="margin-bottom: 12px;">
      ${
        rules.length === 0
          ? html`<div class="empty-state">${localize('editor.entity_names_empty')}</div>`
          : rules.map((rule, index) => {
              const problem = ruleProblemText(rule);
              return html`
              <div class="custom-item" data-name-rule-index=${index}>
                <div class="custom-item-header">
                  <strong>${localize('editor.entity_names_pattern')} ${index + 1}</strong>
                  <button class="btn-remove" @click=${() => removeEntityNameRule(host, index)}>&#x2715;</button>
                </div>
                <div class="custom-item-fields">
                  <div class="custom-item-row">
                    <input
                      type="text"
                      style="flex: 2;"
                      placeholder=${localize('editor.entity_names_pattern')}
                      .value=${rule.pattern || ''}
                      @change=${(event: Event) =>
                        replaceEntityNameRule(host, index, copyRule(rule, { pattern: inputValue(event) }))}
                    />
                    <input
                      type="text"
                      style="flex: 2;"
                      placeholder=${localize('editor.entity_names_replace')}
                      .value=${rule.replace || ''}
                      @change=${(event: Event) =>
                        replaceEntityNameRule(
                          host,
                          index,
                          copyRule(rule, { replace: inputValue(event).trim() || null })
                        )}
                    />
                  </div>
                  <div class="custom-item-row">
                    <input
                      type="text"
                      style="flex: 1;"
                      placeholder=${localize('editor.entity_names_flags')}
                      .value=${rule.flags || ''}
                      @change=${(event: Event) =>
                        replaceEntityNameRule(host, index, copyRule(rule, { flags: inputValue(event).trim() || null }))}
                    />
                    <input
                      type="text"
                      style="flex: 2;"
                      placeholder=${localize('editor.entity_names_domains')}
                      .value=${formatDomains(rule.domains)}
                      @change=${(event: Event) =>
                        replaceEntityNameRule(
                          host,
                          index,
                          copyRule(rule, { domains: parseDomains(inputValue(event)) ?? null })
                        )}
                    />
                  </div>
                  ${problem ? html`<div class="description" style="color: var(--error-color);">${problem}</div>` : nothing}
                </div>
              </div>
            `;
            })
      }
    </div>

    <button class="btn-primary" @click=${() => addEntityNameRule(host)}>
      ${localize('editor.entity_names_add')}
    </button>

    ${
      rules.length === 0
        ? nothing
        : html`
          <div class="description" style="margin-left: 0; margin-top: 16px;">
            <strong>${localize('editor.entity_names_preview')}</strong>
          </div>
          ${
            preview.length === 0
              ? html`<div class="empty-state">${localize('editor.entity_names_preview_none')}</div>`
              : preview.map(
                  (row) => html`
                  <div class="custom-item" style="margin-top: 8px;">
                    <div class="custom-item-header">
                      <strong>${row.before} → ${row.after}</strong>
                    </div>
                    <div class="item-entity-id">${row.entityId}</div>
                  </div>
                `
                )
          }
        `
    }
  `;
}
