import type { LovelaceCardConfig } from '../types/lovelace';
import type { Simon42StrategyConfig } from '../types/strategy';

export type BetterThermostatCardVariant = 'normal' | 'mini';

const BT_CARD_TYPES: Record<BetterThermostatCardVariant, string> = {
  normal: 'custom:better-thermostat-normal-climate-card',
  mini: 'custom:better-thermostat-mini-climate-card',
};

const BT_CUSTOM_ELEMENTS: Record<BetterThermostatCardVariant, string> = {
  normal: 'better-thermostat-normal-climate-card',
  mini: 'better-thermostat-mini-climate-card',
};

export function getBetterThermostatCardVariant(
  config: Simon42StrategyConfig
): BetterThermostatCardVariant {
  return config.better_thermostat_card_variant === 'mini' ? 'mini' : 'normal';
}

export function isBetterThermostatCardAvailable(variant: BetterThermostatCardVariant): boolean {
  return customElements.get(BT_CUSTOM_ELEMENTS[variant]) !== undefined;
}

export function buildClimateCard(
  entityId: string,
  config: Simon42StrategyConfig,
  options?: { name?: string }
): LovelaceCardConfig {
  const variant = getBetterThermostatCardVariant(config);

  if (config.use_better_thermostat_ui_card === true && isBetterThermostatCardAvailable(variant)) {
    const card: LovelaceCardConfig = {
      type: BT_CARD_TYPES[variant],
      entity: entityId,
    };
    if (options?.name) {
      card.name = options.name;
    }
    return card;
  }

  const card: LovelaceCardConfig = {
    type: 'tile',
    entity: entityId,
    vertical: false,
    features: [{ type: 'climate-hvac-modes' }],
    features_position: 'inline',
    state_content: ['hvac_action', 'current_temperature'],
  };
  if (options?.name) {
    card.name = options.name;
  }
  return card;
}
