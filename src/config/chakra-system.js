import { createSystem, defaultConfig } from "@chakra-ui/react";

const ekcScale = {
  50: { value: "#e8f6f5" },
  100: { value: "#d2efee" },
  200: { value: "#abdedd" },
  300: { value: "#74c2c1" },
  400: { value: "#3cc3be" },
  500: { value: "#00b5af" },
  600: { value: "#106f6b" },
  700: { value: "#0a5754" },
  800: { value: "#00413e" },
  900: { value: "#003633" },
  950: { value: "#002724" },
};

export const chakraSystem = createSystem(defaultConfig, {
  theme: {
    tokens: { colors: { ekc: ekcScale } },
    semanticTokens: {
      colors: {
        ekc: {
          contrast: { value: "{colors.white}" },
          fg: { value: { _light: "{colors.ekc.800}", _dark: "{colors.ekc.200}" } },
          subtle: { value: { _light: "{colors.ekc.50}", _dark: "{colors.ekc.950}" } },
          muted: { value: { _light: "{colors.ekc.100}", _dark: "{colors.ekc.900}" } },
          emphasized: { value: { _light: "{colors.ekc.200}", _dark: "{colors.ekc.800}" } },
          solid: { value: "{colors.ekc.600}" },
          focusRing: { value: "{colors.ekc.500}" },
          border: { value: { _light: "{colors.ekc.300}", _dark: "{colors.ekc.700}" } },
        },
      },
    },
  },
});

