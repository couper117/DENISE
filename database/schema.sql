-- DENISE Textile - Complete PostgreSQL Schema
-- New Textile Social Company Limited

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE reservation_status AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED');
CREATE TYPE notification_channel AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE measurement_option AS ENUM ('KNOW_MEASUREMENTS', 'HELP_AT_SHOP', 'WALK_IN_CONSULTATION');

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    dark_mode BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);

-- Refresh Tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(500) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    parent_id UUID REFERENCES categories(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- Category Translations
CREATE TABLE category_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    UNIQUE (category_id, language)
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(300) UNIQUE NOT NULL,
    description TEXT,
    specifications TEXT,
    material VARCHAR(255),
    price_range VARCHAR(100),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_new_arrival BOOLEAN NOT NULL DEFAULT FALSE,
    is_on_promotion BOOLEAN NOT NULL DEFAULT FALSE,
    promotion_text VARCHAR(200),
    category_id UUID NOT NULL REFERENCES categories(id),
    sort_order INT NOT NULL DEFAULT 0,
    view_count INT NOT NULL DEFAULT 0,
    reservation_count INT NOT NULL DEFAULT 0,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_is_new_arrival ON products(is_new_arrival) WHERE is_new_arrival = TRUE;
CREATE INDEX idx_products_is_available ON products(is_available);
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

-- Product Translations
CREATE TABLE product_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    specifications TEXT,
    UNIQUE (product_id, language)
);

-- Product Images
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    public_id VARCHAR(200),
    alt_text VARCHAR(255),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);

-- Product Colors
CREATE TABLE product_colors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    hex_code VARCHAR(10),
    image_url VARCHAR(500)
);

CREATE INDEX idx_product_colors_product_id ON product_colors(product_id);

-- Inventory
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock_count INT NOT NULL DEFAULT 0,
    meters_available DECIMAL(10,2),
    low_stock_alert INT NOT NULL DEFAULT 5,
    is_tracked BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Reservations
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_number VARCHAR(50) UNIQUE NOT NULL,
    qr_code TEXT,
    user_id UUID REFERENCES users(id),
    customer_name VARCHAR(200) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    customer_email VARCHAR(255),
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    visit_date DATE NOT NULL,
    visit_time VARCHAR(10) NOT NULL,
    notes TEXT,
    measurement_option measurement_option NOT NULL DEFAULT 'HELP_AT_SHOP',
    status reservation_status NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    cancel_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reservations_number ON reservations(reservation_number);
CREATE INDEX idx_reservations_phone ON reservations(customer_phone);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_visit_date ON reservations(visit_date);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_created_at ON reservations(created_at);

-- Reservation Items
CREATE TABLE reservation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT,
    meters_required DECIMAL(10,2),
    window_width DECIMAL(10,2),
    window_height DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reservation_items_reservation_id ON reservation_items(reservation_id);
CREATE INDEX idx_reservation_items_product_id ON reservation_items(product_id);

-- Wishlist
CREATE TABLE wishlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

-- Blogs
CREATE TABLE blogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(300) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    image_url VARCHAR(500),
    image_public_id VARCHAR(200),
    author_name VARCHAR(100) NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(500),
    view_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blogs_slug ON blogs(slug);
CREATE INDEX idx_blogs_is_published ON blogs(is_published) WHERE is_published = TRUE;

-- Testimonials
CREATE TABLE testimonials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    rating INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
    image_url VARCHAR(500),
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    reservation_id UUID REFERENCES reservations(id),
    channel notification_channel NOT NULL,
    status notification_status NOT NULL DEFAULT 'PENDING',
    subject VARCHAR(255),
    body TEXT NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_reservation_id ON notifications(reservation_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- Site Content
CREATE TABLE site_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_site_content_key ON site_content(key);

-- FAQs
CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Banners
CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(300),
    image_url VARCHAR(500) NOT NULL,
    image_public_id VARCHAR(200),
    link_url VARCHAR(500),
    link_text VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- SEO Settings
CREATE TABLE seo_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page VARCHAR(100) UNIQUE NOT NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(500),
    og_title VARCHAR(255),
    og_description TEXT,
    og_image VARCHAR(500),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed default categories
INSERT INTO categories (name, slug, description, sort_order) VALUES
('Curtains', 'curtains', 'Premium curtains for every style and space', 1),
('Curtain Rods', 'curtain-rods', 'Quality curtain rods and rails', 2),
('Curtain Accessories', 'accessories', 'Curtain hooks, rings, tiebacks and more', 3),
('Traditional Attire', 'traditional-attire', 'Authentic Rwandan traditional fashion', 4),
('Fabrics', 'fabrics', 'Quality fabrics for clothing and decoration', 5),
('Interior Decoration', 'interior-decoration', 'Fabrics and materials for interior decoration', 6);

-- Seed default FAQs
INSERT INTO faqs (question, answer, language, sort_order) VALUES
('Can I purchase products online?', 'No, we do not sell online. You can browse products and make a reservation, then visit our Kigali store to inspect, confirm measurements, and complete your purchase.', 'en', 1),
('How does the reservation system work?', 'Browse products online, add them to your reservation cart, choose a visit date and time, and submit. Our team will prepare your selected products before you arrive.', 'en', 2),
('What if I don''t know my measurements?', 'No problem! You can reserve products without entering measurements. Select "Help Me Measure at the Shop" and our expert staff will assist you during your visit.', 'en', 3),
('Can I reserve without selecting products?', 'Yes! You can book a walk-in consultation appointment without selecting specific products. Tell us what you need and we''ll prepare recommendations.', 'en', 4),
('How long is a reservation valid?', 'Reservations are typically valid for 7 days from your scheduled visit date. Contact us if you need to reschedule.', 'en', 5);

-- Seed default SEO settings
INSERT INTO seo_settings (page, meta_title, meta_description, meta_keywords) VALUES
('home', 'DENISE Textile | Curtains, Fabrics & Traditional Attire Rwanda', 'Rwanda''s premier textile shop. Premium curtains, fabrics, and traditional attire in Kigali. Reserve online, buy in-store.', 'Denise Textile, curtains Rwanda, fabrics Kigali, traditional attire Rwanda'),
('products', 'Products | DENISE Textile Rwanda', 'Explore our complete collection of curtains, fabrics, traditional attire, and interior decoration materials.', 'textile products Rwanda, curtains Kigali, fabrics Rwanda'),
('reservation', 'Book a Visit | DENISE Textile Rwanda', 'Reserve products and schedule your shop visit at DENISE Textile in Kigali, Rwanda.', 'reserve curtains Rwanda, book textile shop Kigali');
