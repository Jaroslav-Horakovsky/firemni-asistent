--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 15.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: employee_type_enum; Type: TYPE; Schema: public; Owner: dev_user
--

CREATE TYPE public.employee_type_enum AS ENUM (
    'full_time',
    'part_time',
    'contractor',
    'external'
);


ALTER TYPE public.employee_type_enum OWNER TO dev_user;

--
-- Name: order_status_enum; Type: TYPE; Schema: public; Owner: dev_user
--

CREATE TYPE public.order_status_enum AS ENUM (
    'draft',
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
);


ALTER TYPE public.order_status_enum OWNER TO dev_user;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: dev_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO dev_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name character varying(255) NOT NULL,
    contact_person character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    postal_code character varying(20),
    country character varying(100) DEFAULT 'Czech Republic'::character varying,
    tax_id character varying(50),
    vat_id character varying(50),
    payment_terms integer DEFAULT 14,
    credit_limit numeric(12,2) DEFAULT 0.00,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO dev_user;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_number character varying(50) NOT NULL,
    user_id uuid,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    "position" character varying(100),
    department character varying(100),
    employment_type public.employee_type_enum DEFAULT 'full_time'::public.employee_type_enum,
    hourly_rate numeric(10,2),
    hire_date date,
    is_active boolean DEFAULT true,
    skills jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT positive_hourly_rate CHECK ((hourly_rate >= (0)::numeric)),
    CONSTRAINT valid_email CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text))
);


ALTER TABLE public.employees OWNER TO dev_user;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id character varying(100),
    product_name character varying(255) NOT NULL,
    product_description text,
    product_sku character varying(100),
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT calculated_total CHECK ((total_price = ((quantity)::numeric * unit_price))),
    CONSTRAINT positive_quantity CHECK ((quantity > 0)),
    CONSTRAINT positive_total_price CHECK ((total_price >= (0)::numeric)),
    CONSTRAINT positive_unit_price CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.order_items OWNER TO dev_user;

--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.order_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    previous_status public.order_status_enum,
    new_status public.order_status_enum NOT NULL,
    changed_by uuid,
    change_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.order_status_history OWNER TO dev_user;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number character varying(50) NOT NULL,
    customer_id uuid NOT NULL,
    status public.order_status_enum DEFAULT 'draft'::public.order_status_enum,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    shipping_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'CZK'::character varying,
    shipping_address_line1 character varying(255),
    shipping_address_line2 character varying(255),
    shipping_city character varying(100),
    shipping_postal_code character varying(20),
    shipping_country character varying(100) DEFAULT 'Czech Republic'::character varying,
    billing_address_line1 character varying(255),
    billing_address_line2 character varying(255),
    billing_city character varying(100),
    billing_postal_code character varying(20),
    billing_country character varying(100) DEFAULT 'Czech Republic'::character varying,
    notes text,
    internal_notes text,
    expected_delivery_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT positive_subtotal CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT positive_total CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT valid_currency CHECK (((currency)::text = ANY ((ARRAY['CZK'::character varying, 'EUR'::character varying, 'USD'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO dev_user;

--
-- Name: project_assignments; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.project_assignments (
    id integer NOT NULL,
    project_id integer,
    employee_id integer NOT NULL,
    role character varying(100),
    allocation_percentage integer DEFAULT 100,
    start_date date,
    end_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.project_assignments OWNER TO dev_user;

--
-- Name: project_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: dev_user
--

CREATE SEQUENCE public.project_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.project_assignments_id_seq OWNER TO dev_user;

--
-- Name: project_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dev_user
--

ALTER SEQUENCE public.project_assignments_id_seq OWNED BY public.project_assignments.id;


--
-- Name: project_tasks; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.project_tasks (
    id integer NOT NULL,
    project_id integer,
    name character varying(255) NOT NULL,
    description text,
    assigned_employee_id integer,
    status character varying(50) DEFAULT 'todo'::character varying,
    priority character varying(20) DEFAULT 'medium'::character varying,
    estimated_hours integer,
    start_date date,
    due_date date,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.project_tasks OWNER TO dev_user;

--
-- Name: project_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: dev_user
--

CREATE SEQUENCE public.project_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.project_tasks_id_seq OWNER TO dev_user;

--
-- Name: project_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dev_user
--

ALTER SEQUENCE public.project_tasks_id_seq OWNED BY public.project_tasks.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    customer_id integer NOT NULL,
    order_id integer,
    status character varying(50) DEFAULT 'planning'::character varying,
    start_date date,
    end_date date,
    estimated_hours integer,
    budget_amount numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.projects OWNER TO dev_user;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: dev_user
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.projects_id_seq OWNER TO dev_user;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dev_user
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: task_dependencies; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.task_dependencies (
    id integer NOT NULL,
    task_id integer,
    depends_on_task_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_dependencies OWNER TO dev_user;

--
-- Name: task_dependencies_id_seq; Type: SEQUENCE; Schema: public; Owner: dev_user
--

CREATE SEQUENCE public.task_dependencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.task_dependencies_id_seq OWNER TO dev_user;

--
-- Name: task_dependencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dev_user
--

ALTER SEQUENCE public.task_dependencies_id_seq OWNED BY public.task_dependencies.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: dev_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    email_verification_token character varying(255),
    password_reset_token character varying(255),
    password_reset_expires timestamp with time zone,
    last_login timestamp with time zone,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO dev_user;

--
-- Name: project_assignments id; Type: DEFAULT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.project_assignments ALTER COLUMN id SET DEFAULT nextval('public.project_assignments_id_seq'::regclass);


--
-- Name: project_tasks id; Type: DEFAULT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.project_tasks ALTER COLUMN id SET DEFAULT nextval('public.project_tasks_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: task_dependencies id; Type: DEFAULT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.task_dependencies ALTER COLUMN id SET DEFAULT nextval('public.task_dependencies_id_seq'::regclass);


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.customers (id, company_name, contact_person, email, phone, address_line1, address_line2, city, postal_code, country, tax_id, vat_id, payment_terms, credit_limit, is_active, notes, created_at, updated_at) FROM stdin;
91acb0d1-5175-42b5-b86b-9e6345f813c9	Test Company s.r.o.	Jan Novák	jan@testcompany.cz	+420777123456	Václavské náměstí 1	\N	Praha	11000	Czech Republic	CZ12345678	CZ12345678	14	75000.00	t	Updated credit limit for workflow testing	2025-08-09 12:51:52.759973+00	2025-08-09 12:52:05.415148+00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.employees (id, employee_number, user_id, first_name, last_name, email, phone, "position", department, employment_type, hourly_rate, hire_date, is_active, skills, notes, created_at, updated_at) FROM stdin;
f26c0086-c1c2-4ccf-88bf-1cd0dffa68d7	EMP-001	\N	Jana	Svoboda	jana.svoboda@company.cz	+420777654321	Senior Developer	IT	full_time	850.00	\N	t	["JavaScript", "React", "Node.js", "PostgreSQL", "Docker"]	Lead frontend developer	2025-08-09 12:55:13.495154+00	2025-08-09 12:55:13.495154+00
c35c7120-1018-4948-a96b-45007e6c1ef9	EMP-002	\N	Pavel	Novotný	pavel.novotny@company.cz	+420777111222	Marketing Specialist	Marketing	full_time	650.00	\N	t	["SEO", "Google Ads", "Content Marketing", "Social Media"]	Digital marketing expert	2025-08-09 12:55:30.220885+00	2025-08-09 12:55:30.220885+00
6bee8ac1-2c78-4c06-bff3-7535a485ebad	EXT-003	\N	Tomáš	Dvořák	tomas.dvorak@external.cz	+420777999888	DevOps Consultant	IT	external	1200.00	\N	t	["Kubernetes", "Docker", "AWS", "Terraform", "CI/CD"]	External DevOps specialist	2025-08-09 12:55:38.337029+00	2025-08-09 12:55:38.337029+00
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.order_items (id, order_id, product_id, product_name, product_description, product_sku, quantity, unit_price, total_price, notes, created_at) FROM stdin;
\.


--
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.order_status_history (id, order_id, previous_status, new_status, changed_by, change_reason, notes, created_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.orders (id, order_number, customer_id, status, subtotal, tax_amount, shipping_amount, discount_amount, total_amount, currency, shipping_address_line1, shipping_address_line2, shipping_city, shipping_postal_code, shipping_country, billing_address_line1, billing_address_line2, billing_city, billing_postal_code, billing_country, notes, internal_notes, expected_delivery_date, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: project_assignments; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.project_assignments (id, project_id, employee_id, role, allocation_percentage, start_date, end_date, created_at) FROM stdin;
\.


--
-- Data for Name: project_tasks; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.project_tasks (id, project_id, name, description, assigned_employee_id, status, priority, estimated_hours, start_date, due_date, completed_at, created_at, updated_at) FROM stdin;
1	1	Setup Development Environment	Configure dev environment and tools	\N	todo	medium	8	\N	\N	\N	2025-08-09 13:30:38.077484	2025-08-09 13:30:38.077484
2	1	Database Design	Design database schema	\N	todo	medium	16	\N	\N	\N	2025-08-09 13:30:38.124686	2025-08-09 13:30:38.124686
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.projects (id, name, description, customer_id, order_id, status, start_date, end_date, estimated_hours, budget_amount, created_at, updated_at) FROM stdin;
2	Direct Test Project 2	Testing direct endpoint	2	\N	planning	\N	\N	120	15000.00	2025-08-09 13:28:27.013779	2025-08-09 13:28:27.013779
1	Updated Test Project	Updated description	1	\N	active	\N	\N	110	12000.00	2025-08-09 13:25:42.279458	2025-08-09 13:29:52.799732
\.


--
-- Data for Name: task_dependencies; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.task_dependencies (id, task_id, depends_on_task_id, created_at) FROM stdin;
1	2	1	2025-08-09 13:30:43.049276
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: dev_user
--

COPY public.users (id, email, password_hash, first_name, last_name, role, is_active, email_verified, email_verification_token, password_reset_token, password_reset_expires, last_login, failed_login_attempts, locked_until, created_at, updated_at) FROM stdin;
ee903f56-3927-4409-b203-21036b61a7a9	user@test.com	$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeRLFZjXH8ze8NsXW	Test	User	user	t	t	\N	\N	\N	\N	0	\N	2025-07-30 13:14:26.042382+00	2025-07-30 13:14:26.042382+00
96748b93-4a74-490c-99e0-2967fa5c1f04	manager@test.com	$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeRLFZjXH8ze8NsXW	Manager	User	manager	t	f	\N	\N	\N	\N	0	\N	2025-07-30 13:14:26.042382+00	2025-07-30 13:14:26.042382+00
1ca1fc3f-d49d-4aea-b6ee-9bd290f6bbbe	test@example.com	$2a$12$27gv6GfDy/R.OHJY4.Ka9Opm8d3IlpdBG/wugMVKHGAdebpfD1bvu	Test	User	user	t	f	\N	\N	\N	2025-08-09 13:10:12.585555+00	0	\N	2025-08-09 12:44:16.855348+00	2025-08-09 13:10:12.585555+00
017106df-0ebf-4eea-b4f0-f2fe67e6679f	admin@test.com	$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeRLFZjXH8ze8NsXW	Admin	User	admin	t	t	\N	\N	\N	\N	4	\N	2025-07-30 13:14:26.042382+00	2025-08-09 13:24:28.695603+00
d290a0f2-32ff-452f-b94a-ad860e157621	testjwt@example.com	$2a$12$SOT7MdKBxenqZUt1fb7Eg.o8R9PIOLDDMXiUteWsgGHF0oYSilWHy	Test	JWT	user	t	f	\N	\N	\N	\N	0	\N	2025-08-09 13:24:38.230762+00	2025-08-09 13:24:38.230762+00
\.


--
-- Name: project_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dev_user
--

SELECT pg_catalog.setval('public.project_assignments_id_seq', 1, false);


--
-- Name: project_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dev_user
--

SELECT pg_catalog.setval('public.project_tasks_id_seq', 2, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dev_user
--

SELECT pg_catalog.setval('public.projects_id_seq', 2, true);


--
-- Name: task_dependencies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dev_user
--

SELECT pg_catalog.setval('public.task_dependencies_id_seq', 1, true);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_employee_number_key; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_number_key UNIQUE (employee_number);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: project_assignments project_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_pkey PRIMARY KEY (id);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: task_dependencies task_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_customers_company_name; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_customers_company_name ON public.customers USING btree (company_name);


--
-- Name: idx_customers_created_at; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_customers_created_at ON public.customers USING btree (created_at);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_customers_is_active; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_customers_is_active ON public.customers USING btree (is_active);


--
-- Name: idx_customers_tax_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_customers_tax_id ON public.customers USING btree (tax_id);


--
-- Name: idx_employees_created_at; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_employees_created_at ON public.employees USING btree (created_at);


--
-- Name: idx_employees_department; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_employees_department ON public.employees USING btree (department);


--
-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_employees_email ON public.employees USING btree (email);


--
-- Name: idx_employees_employee_number; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_employees_employee_number ON public.employees USING btree (employee_number);


--
-- Name: idx_employees_employment_type; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_employees_employment_type ON public.employees USING btree (employment_type);


--
-- Name: idx_employees_is_active; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_employees_is_active ON public.employees USING btree (is_active);


--
-- Name: idx_employees_skills; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_employees_skills ON public.employees USING gin (skills);


--
-- Name: idx_employees_user_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_employees_user_id ON public.employees USING btree (user_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_order_status_history_created_at; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_order_status_history_created_at ON public.order_status_history USING btree (created_at);


--
-- Name: idx_order_status_history_order_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history USING btree (order_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_order_number; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_project_assignments_created_at; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_project_assignments_created_at ON public.project_assignments USING btree (created_at);


--
-- Name: idx_project_assignments_employee_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_project_assignments_employee_id ON public.project_assignments USING btree (employee_id);


--
-- Name: idx_project_assignments_project_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_project_assignments_project_id ON public.project_assignments USING btree (project_id);


--
-- Name: idx_project_tasks_assigned_employee_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_project_tasks_assigned_employee_id ON public.project_tasks USING btree (assigned_employee_id) WHERE (assigned_employee_id IS NOT NULL);


--
-- Name: idx_project_tasks_created_at; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_project_tasks_created_at ON public.project_tasks USING btree (created_at);


--
-- Name: idx_project_tasks_due_date; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_project_tasks_due_date ON public.project_tasks USING btree (due_date) WHERE (due_date IS NOT NULL);


--
-- Name: idx_project_tasks_priority; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_project_tasks_priority ON public.project_tasks USING btree (priority);


--
-- Name: idx_project_tasks_project_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_project_tasks_project_id ON public.project_tasks USING btree (project_id);


--
-- Name: idx_project_tasks_status; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_project_tasks_status ON public.project_tasks USING btree (status);


--
-- Name: idx_projects_created_at; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_projects_created_at ON public.projects USING btree (created_at);


--
-- Name: idx_projects_customer_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_projects_customer_id ON public.projects USING btree (customer_id);


--
-- Name: idx_projects_end_date; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_projects_end_date ON public.projects USING btree (end_date) WHERE (end_date IS NOT NULL);


--
-- Name: idx_projects_order_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_projects_order_id ON public.projects USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: idx_projects_start_date; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_projects_start_date ON public.projects USING btree (start_date) WHERE (start_date IS NOT NULL);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_projects_status ON public.projects USING btree (status);


--
-- Name: idx_task_dependencies_depends_on_task_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_task_dependencies_depends_on_task_id ON public.task_dependencies USING btree (depends_on_task_id);


--
-- Name: idx_task_dependencies_task_id; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_task_dependencies_task_id ON public.task_dependencies USING btree (task_id);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_users_created_at ON public.users USING btree (created_at);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_email_verified; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_users_email_verified ON public.users USING btree (email_verified);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_password_reset_token; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_users_password_reset_token ON public.users USING btree (password_reset_token);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: dev_user
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: dev_user
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public; Owner: dev_user
--

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: dev_user
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_tasks update_project_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: dev_user
--

CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: dev_user
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: dev_user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: project_assignments project_assignments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_depends_on_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_depends_on_task_id_fkey FOREIGN KEY (depends_on_task_id) REFERENCES public.project_tasks(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dev_user
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.project_tasks(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

