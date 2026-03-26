
CREATE OR REPLACE FUNCTION public.normalize_product_name(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  result text;
BEGIN
  result := lower(btrim(input));
  result := translate(result,
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ',
    'aaaaaaeeeeiiiioooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC'
  );
  result := regexp_replace(result, '[^a-z0-9 ]', '', 'g');
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := btrim(result);
  RETURN result;
END;
$$;
