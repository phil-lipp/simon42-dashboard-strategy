import type { LovelaceCardConfig } from '../types/lovelace';
import type { Simon42StrategyConfig } from '../types/strategy';

const CLOCK_WEATHER_CARD_TYPE = 'custom:clock-weather-card';
const HORIZON_CARD_TYPE = 'custom:horizon-card';

export function isClockWeatherCardAvailable(): boolean {
  return customElements.get('clock-weather-card') !== undefined;
}

export function isHorizonCardAvailable(): boolean {
  return customElements.get('horizon-card') !== undefined;
}

export function buildWeatherForecastCard(
  weatherEntity: string,
  config: Simon42StrategyConfig
): LovelaceCardConfig {
  if (config.use_clock_weather_card === true && isClockWeatherCardAvailable()) {
    return {
      type: CLOCK_WEATHER_CARD_TYPE,
      entity: weatherEntity,
    };
  }

  return {
    type: 'weather-forecast',
    entity: weatherEntity,
    forecast_type: 'daily',
  };
}

export function buildHorizonCard(): LovelaceCardConfig {
  return {
    type: HORIZON_CARD_TYPE,
  };
}

export function shouldShowHorizonCard(config: Simon42StrategyConfig): boolean {
  return config.show_horizon_card === true && isHorizonCardAvailable();
}
