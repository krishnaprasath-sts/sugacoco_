import { Box } from '@mui/material';
import logoSrc from '../assets/sugacoco-logo.webp';

// The image file is 222 x 94. Width and height attributes let the browser keep its place before it loads.
const RATIO = 222 / 94;

/** Sugacoco brand logo. The image has its own dark background, so it shows as a rounded badge.
 *  Pass `width` to size by width, otherwise `height` is used. Never stretches to fill its parent. */
export default function Logo({ height = 44, width }: { height?: number; width?: number; light?: boolean }) {
  return (
    <Box
      component="img"
      src={logoSrc}
      alt="Sugacoco - Global Exporter since 1989"
      width={width ?? Math.round(height * RATIO)}
      height={width ? Math.round(width / RATIO) : height}
      sx={{
        width: width ?? 'auto',
        height: width ? 'auto' : height,
        maxWidth: '100%',
        alignSelf: 'flex-start',
        display: 'block',
        borderRadius: '8px',
      }}
    />
  );
}
