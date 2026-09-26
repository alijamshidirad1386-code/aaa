-- Optional: remove only the old PetraPet demo products shipped by earlier builds.
-- This does NOT delete products you created yourself with different IDs.

DELETE FROM customer_wishlist WHERE product_id IN (
  'fox_rc_fit32','fox_rc_kitten','fox_rc_urinary','fox_gimcat_malt',
  'fox_schesir_tuna','fox_wanpy_creamy','fox_bentonite_litter','fox_laser_toy'
);
DELETE FROM customer_cart WHERE product_id IN (
  'fox_rc_fit32','fox_rc_kitten','fox_rc_urinary','fox_gimcat_malt',
  'fox_schesir_tuna','fox_wanpy_creamy','fox_bentonite_litter','fox_laser_toy'
);
DELETE FROM products WHERE id IN (
  'fox_rc_fit32','fox_rc_kitten','fox_rc_urinary','fox_gimcat_malt',
  'fox_schesir_tuna','fox_wanpy_creamy','fox_bentonite_litter','fox_laser_toy'
);
