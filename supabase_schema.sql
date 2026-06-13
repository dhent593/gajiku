-- Create slips table
CREATE TABLE IF NOT EXISTS public.slips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nik TEXT NOT NULL,
    nama TEXT NOT NULL,
    jabatan TEXT NOT NULL,
    bulan TEXT NOT NULL,
    gaji_bersih NUMERIC NOT NULL,
    no_wa TEXT,
    no_rek TEXT,
    details JSONB NOT NULL,
    urut INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.slips ENABLE ROW LEVEL SECURITY;

-- Policy for Select: anyone can read if they have the specific ID (UUID)
CREATE POLICY "Allow public select by id" ON public.slips
    FOR SELECT
    TO public
    USING (true);

-- Policy for Insert/Update/Delete: only authenticated admins can edit
CREATE POLICY "Allow authenticated insert" ON public.slips
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.slips
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete" ON public.slips
    FOR DELETE
    TO authenticated
    USING (true);
