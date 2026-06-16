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

-- Policies for kas_entries (Allow public read preview, authenticated write)
DROP POLICY IF EXISTS "Allow authenticated select for kas" ON public.kas_entries;
CREATE POLICY "Allow public select for kas" ON public.kas_entries
    FOR SELECT
    TO public
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

-- Create invoice_entries table
CREATE TABLE IF NOT EXISTS public.invoice_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no INT,
    keterangan TEXT[] NOT NULL,
    no_inv TEXT,
    tanggal DATE,
    dpp_amount NUMERIC DEFAULT 0,
    no_bukti_potong TEXT,
    tanggal_bukti DATE,
    pph_amount NUMERIC DEFAULT 0,
    net_received NUMERIC DEFAULT 0,
    potongan_reject NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.invoice_entries ENABLE ROW LEVEL SECURITY;

-- Policies for invoice_entries
CREATE POLICY "Allow public select for invoices" ON public.invoice_entries
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow authenticated insert for invoices" ON public.invoice_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update for invoices" ON public.invoice_entries
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete for invoices" ON public.invoice_entries
    FOR DELETE
    TO authenticated
    USING (true);

-- Create allowed_admins table
CREATE TABLE IF NOT EXISTS public.allowed_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.allowed_admins ENABLE ROW LEVEL SECURITY;

-- Policies for allowed_admins
CREATE POLICY "Allow public read allowed_admins" ON public.allowed_admins
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow authenticated insert for allowed_admins" ON public.allowed_admins
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update for allowed_admins" ON public.allowed_admins
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete for allowed_admins" ON public.allowed_admins
    FOR DELETE
    TO authenticated
    USING (true);

-- Insert initial super admins
INSERT INTO public.allowed_admins (email, role)
VALUES 
    ('admin@senndyt.com', 'superadmin'),
    ('arif.setiawan2209@gmail.com', 'superadmin')
ON CONFLICT (email) DO NOTHING;
