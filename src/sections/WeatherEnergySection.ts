// ====================================================================
// Weather & Energy Section Builders
// ====================================================================
// Independent section builders for weather forecast and energy
// distribution. Each returns a single section or null.
// ====================================================================

import type { LovelaceSectionConfig, LovelaceCardConfig } from '../types/lovelace';
import type { Simon42StrategyConfig } from '../types/strategy';
import { localize } from '../utils/localize';
import {
  buildHorizonCard,
  buildWeatherForecastCard,
  shouldShowHorizonCard,
} from '../utils/weather-card-builder';

/**
 * Creates the weather forecast section.
 * Returns null if weather is disabled or no card can be shown.
 */
export function createWeatherSection(
  weatherEntity: string | null,
  config: Simon42StrategyConfig
): LovelaceSectionConfig | null {
  const showWeather = config.show_weather !== false;
  if (!showWeather) return null;

  const showHorizon = shouldShowHorizonCard(config);
  if (!weatherEntity && !showHorizon) return null;

  const cards: LovelaceCardConfig[] = [
    {
      type: 'heading',
      heading: localize('sections.weather'),
      heading_style: 'title',
      icon: 'mdi:weather-partly-cloudy',
    },
  ];

  if (weatherEntity) {
    cards.push(buildWeatherForecastCard(weatherEntity, config));
  }

  if (showHorizon) {
    cards.push(buildHorizonCard());
  }

  return {
    type: 'grid',
    cards,
  };
}

/**
 * Creates the energy distribution section.
 * Returns null if energy is disabled.
 */
export function createEnergySection(
  showEnergy: boolean,
  linkDashboard: boolean = true
): LovelaceSectionConfig | null {
  if (!showEnergy) return null;

  return {
    type: 'grid',
    cards: [
      {
        type: 'heading',
        heading: localize('sections.energy'),
        heading_style: 'title',
        icon: 'mdi:lightning-bolt',
      },
      {
        type: 'energy-distribution',
        link_dashboard: linkDashboard,
      },
    ],
  };
}
