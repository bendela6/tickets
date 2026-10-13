-- TK-5.21.1: an option's, a status's and a type's config.color names one of
-- bh's eleven hues ("purple"), not a hex. Each stored hex becomes the hue the
-- web's hexToOptionColor gave it until now, so nothing looks different
-- afterwards: the nearest of the hue anchors below to the color's HSL hue, or
-- gray when it is unsaturated (saturation under 0.14) or not a six-digit hex
-- at all. A value that already names a hue stays as it is. The arithmetic is
-- double precision, done in hexToOptionColor's order, so a color on a boundary
-- falls the same way it did.
CREATE FUNCTION pg_temp.hex_to_hue(stored text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  digits text := substring(btrim(stored, E' \t\r\n') FROM '^#?([0-9a-fA-F]{6})$');
  r float8;
  g float8;
  b float8;
  hi float8;
  lo float8;
  delta float8;
  lightness float8;
  saturation float8;
  hue float8;
BEGIN
  IF digits IS NULL THEN
    RETURN 'gray';
  END IF;
  r := ('x' || substr(digits, 1, 2))::bit(8)::int::float8 / 255::float8;
  g := ('x' || substr(digits, 3, 2))::bit(8)::int::float8 / 255::float8;
  b := ('x' || substr(digits, 5, 2))::bit(8)::int::float8 / 255::float8;
  hi := greatest(r, g, b);
  lo := least(r, g, b);
  delta := hi - lo;
  lightness := (hi + lo) / 2::float8;
  saturation := CASE WHEN delta = 0 THEN 0::float8 ELSE delta / (1::float8 - abs(2::float8 * lightness - 1::float8)) END;
  IF saturation < 0.14::float8 OR delta = 0 THEN
    RETURN 'gray';
  END IF;
  -- hexToOptionColor's `% 6` on the red branch never changes its operand,
  -- which lies within [-1, 1].
  IF hi = r THEN
    hue := 60::float8 * ((g - b) / delta);
  ELSIF hi = g THEN
    hue := 60::float8 * ((b - r) / delta + 2::float8);
  ELSE
    hue := 60::float8 * ((r - g) / delta + 4::float8);
  END IF;
  -- (hue + 360) % 360, for a hue within [-60, 300].
  hue := hue + 360::float8;
  IF hue >= 360::float8 THEN
    hue := hue - 360::float8;
  END IF;
  -- The nearest anchor; on a tie, the one listed first.
  RETURN (
    SELECT a.color
    FROM (VALUES
      (1, 'red', 0), (2, 'orange', 28), (3, 'yellow', 48), (4, 'green', 130),
      (5, 'teal', 168), (6, 'cyan', 194), (7, 'blue', 220), (8, 'indigo', 250),
      (9, 'purple', 282), (10, 'pink', 330), (11, 'red', 360)
    ) AS a(n, color, anchor)
    ORDER BY abs(hue - a.anchor::float8), a.n
    LIMIT 1
  );
END
$$;--> statement-breakpoint
UPDATE "structure"."options"
SET "config" = jsonb_set("config", '{color}', to_jsonb(pg_temp.hex_to_hue("config"->>'color')))
WHERE jsonb_typeof("config"->'color') = 'string'
  AND "config"->>'color' NOT IN ('red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'gray');--> statement-breakpoint
UPDATE "structure"."item_types"
SET "config" = jsonb_set("config", '{color}', to_jsonb(pg_temp.hex_to_hue("config"->>'color')))
WHERE jsonb_typeof("config"->'color') = 'string'
  AND "config"->>'color' NOT IN ('red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'gray');--> statement-breakpoint
DROP FUNCTION pg_temp.hex_to_hue(text);
