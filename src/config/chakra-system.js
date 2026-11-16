import { createSystem, defaultConfig } from "@chakra-ui/react";

const brandScale = {
  50: { value: "#edf2ff" },
  100: { value: "#dbe5ff" },
  200: { value: "#c3d3ff" },
  300: { value: "#9bb5f4" },
  400: { value: "#7192ed" },
  500: { value: "#3b65d9" },
  600: { value: "#2748ad" },
  700: { value: "#1e398d" },
  800: { value: "#17284b" },
  900: { value: "#111e37" },
  950: { value: "#0b1325" },
};

export const chakraSystem = createSystem(defaultConfig, {
  theme: {
    tokens: { colors: { brand: brandScale } },
    semanticTokens: {
      colors: {
        brand: {
          contrast: { value: "{colors.white}" },
          fg: { value: { _light: "{colors.brand.800}", _dark: "{colors.brand.200}" } },
          subtle: { value: { _light: "{colors.brand.50}", _dark: "{colors.brand.950}" } },
          muted: { value: { _light: "{colors.brand.100}", _dark: "{colors.brand.900}" } },
          emphasized: { value: { _light: "{colors.brand.200}", _dark: "{colors.brand.800}" } },
          solid: { value: "{colors.brand.600}" },
          focusRing: { value: "{colors.brand.500}" },
          border: { value: { _light: "{colors.brand.300}", _dark: "{colors.brand.700}" } },
        },
      },
    },
  },
});
