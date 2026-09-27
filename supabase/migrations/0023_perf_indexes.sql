-- 0023_perf_indexes.sql — indexes for the admin panel's busiest lists as a lab's data grows.

-- Lab bench / results release: orders by status, oldest or newest first.
create index if not exists idx_orders_status_created on test_orders (status, created_at);
-- Orders register: newest first.
create index if not exists idx_orders_date_created on test_orders (order_date desc, created_at desc);
-- A patient's visits (count and last visit on the patients list).
create index if not exists idx_orders_patient_date on test_orders (patient_id, order_date desc);
-- Results of each order line (lab bench «pending» counts).
create index if not exists idx_results_item on test_results (order_item_id);
-- Invoices: newest first, and «has an invoice» for an order.
create index if not exists idx_invoices_created on invoices (created_at desc);
create index if not exists idx_invoices_order on invoices (order_id);
-- Newest patients and purchase orders first.
create index if not exists idx_patients_created on patients (created_at desc);
create index if not exists idx_po_created on purchase_orders (created_at desc);
