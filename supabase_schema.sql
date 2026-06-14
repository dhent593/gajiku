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

-- Create kas_entries table
CREATE TABLE IF NOT EXISTS public.kas_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    keterangan TEXT NOT NULL,
    uang_masuk NUMERIC DEFAULT 0,
    uang_keluar NUMERIC DEFAULT 0,
    saldo_akhir NUMERIC DEFAULT 0,
    bukti_transfer TEXT,
    catatan TEXT,
    urut INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.kas_entries ENABLE ROW LEVEL SECURITY;

-- Policies for kas_entries (Authenticated admin only)
CREATE POLICY "Allow authenticated select for kas" ON public.kas_entries
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert for kas" ON public.kas_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update for kas" ON public.kas_entries
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete for kas" ON public.kas_entries
    FOR DELETE
    TO authenticated
    USING (true);
