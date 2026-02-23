-- Payments RLS policies

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow exporter (or provider) to view payments for their bookings
CREATE POLICY "Users can view payments for their bookings" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      LEFT JOIN containers ON containers.id = bookings.container_id
      WHERE bookings.id = payments.booking_id
        AND (bookings.exporter_id = auth.uid() OR containers.provider_id = auth.uid())
    )
  );

-- Allow exporter to insert payments for their bookings
CREATE POLICY "Exporters can insert payments for their bookings" ON payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = payments.booking_id
        AND bookings.exporter_id = auth.uid()
    )
  );
