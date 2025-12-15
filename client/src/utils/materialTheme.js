import { themeFromSourceColor, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

export function generateTheme(sourceHex) {
    // 1. Generate the Material Design 3 palette from the source color
    const argb = argbFromHex(sourceHex);
    const theme = themeFromSourceColor(argb);

    // 2. Helper to extract hex from the generated theme
    const toHex = (scheme) => {
        const colors = {};
        for (const [key, value] of Object.entries(scheme.toJSON())) {
            colors[key.replace(/([A-Z])/g, "-$1").toLowerCase()] = hexFromArgb(value);
        }
        return colors;
    };

    // 3. Return Vuetify-compatible color objects
    return {
        light: toHex(theme.schemes.light),
        dark: toHex(theme.schemes.dark)
    };
}