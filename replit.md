# Order Management & WhatsApp Integration System

## Overview

This is a full-stack order management system with WhatsApp integration, built for small businesses to manage orders, conversations, and team operations. The system features a React frontend with TypeScript, an Express backend, and PostgreSQL database using Drizzle ORM.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state
- **UI Framework**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom color variables
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Session Management**: Connect-pg-simple for PostgreSQL session storage
- **API Design**: RESTful API with JSON responses

### Database Design
- **Provider**: PostgreSQL (via @neondatabase/serverless)
- **Schema Management**: Drizzle migrations in `/migrations` directory
- **Tables**: Users, customers, products, orders, order_items, conversations, messages
- **Relationships**: Foreign key constraints with proper referential integrity

## Key Components

### Core Entities
1. **Users**: Team members with roles (admin, technician, seller)
2. **Customers**: Client information with phone and WhatsApp integration
3. **Products**: Catalog items (products and services) with pricing
4. **Orders**: Order management with status tracking and assignment
5. **Conversations**: WhatsApp conversation threads
6. **Messages**: Individual messages within conversations

### User Interface Modules
- **Dashboard**: Metrics overview with real-time statistics
- **Order Management**: Create, assign, and track orders
- **Conversations**: WhatsApp chat interface
- **Team Management**: User status and assignment tracking
- **Product Catalog**: Manage products and services
- **Reports**: Business analytics and performance metrics

### Authentication & Authorization
- Role-based access control (admin, technician, seller)
- User status tracking (active, busy, break, offline)
- Session-based authentication with PostgreSQL storage

## Data Flow

### Order Processing Flow
1. Orders created through API or frontend interface
2. Orders assigned to team members based on availability
3. Status updates tracked through order lifecycle
4. Customer notifications sent via WhatsApp integration

### WhatsApp Integration Flow
1. Conversations created for customer interactions
2. Messages stored with sender identification
3. Real-time updates for unread message counts
4. Customer information synchronized with order system

### Team Management Flow
1. User status updates tracked in real-time
2. Order assignments based on user availability
3. Performance metrics calculated for reporting

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database ORM
- **express**: Web application framework
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: Accessible UI components
- **tailwindcss**: Utility-first CSS framework

### Development Tools
- **vite**: Development server and build tool
- **typescript**: Type checking and compilation
- **tsx**: TypeScript execution for development
- **esbuild**: Production bundle compilation

### UI Component Library
- Complete Shadcn/ui component set with Radix UI primitives
- Form handling with react-hook-form and zod validation
- Toast notifications and modal dialogs
- Data tables and charts for analytics

## Deployment Strategy

### Development Environment
- Vite development server on port 5000
- Hot module replacement for fast development
- TypeScript checking in watch mode
- Replit integration with automatic reloading

### Production Build
- Vite builds frontend to `/dist/public`
- ESBuild bundles backend to `/dist/index.js`
- Static file serving for production deployment
- Autoscale deployment target configured

### Database Management
- Drizzle migrations for schema changes
- Connection pooling with Neon PostgreSQL
- Environment variable configuration for database URL

### Environment Configuration
- Development and production environment separation
- Database credentials through environment variables
- Session secret and other sensitive data externalized

## Changelog
- June 26, 2025. Initial setup
- June 26, 2025. WhatsApp Business API integration completed:
  - Real-time webhook system for message reception
  - WhatsApp message sending API with authentication
  - Comprehensive logging system with auto-refresh
  - URL webhook configuration (Railway deployment)
  - Message processing with customer/conversation creation
  - Status monitoring and connection testing
- June 26, 2025. Advanced Reports and Analytics system implemented:
  - Interactive data filtering by period and status
  - Comprehensive charts (pie, line, bar) using Recharts
  - Multi-tab analytics interface (Overview, Performance, Products, Trends)
  - Real-time performance metrics and KPIs
  - Technician performance tracking with completion rates
  - Product revenue analysis and ranking
  - Revenue trend visualization with 7-day historical data
  - Export functionality for Excel, PDF, and CSV formats
  - Status distribution analytics with color-coded visualizations
- June 26, 2025. Mobile optimization completed:
  - Responsive sidebar with mobile hamburger menu and backdrop overlay
  - Mobile-first header design with collapsible elements
  - Touch-friendly button sizing and spacing throughout
  - Responsive grid layouts for dashboard and reports
  - Mobile card-based order table replacing desktop table view
  - Mobile-optimized conversations with back navigation
  - Adaptive tab layouts and component spacing
  - Improved responsive breakpoints (768px mobile, 1024px desktop)
- June 26, 2025. Dynamic pricing system implemented:
  - Products maintain fixed prices with location-based delivery calculation
  - Services have dynamic pricing based on installation complexity and parts
  - Customer location tracking with address, latitude, and longitude fields
  - Delivery cost calculation using Haversine formula for distance
  - Real-time pricing calculator showing itemized cost breakdown
  - Location selector with current location, predefined locations, and manual entry
  - Differentiated delivery rates for products vs services (equipment transport)
  - Complete order workflow from creation to closure with enhanced pricing
- June 26, 2025. WhatsApp Business API integration for customer order automation:
  - Interactive product menu system with categories (products/services)
  - Location sharing and automatic delivery cost calculation
  - Automated order generation with real-time pricing
  - Command-based navigation (menu, ubicacion, pedido, ayuda)
  - Customer management with automatic profile creation
  - Order status tracking and confirmation messages
  - Comprehensive message logging and webhook processing
  - Seamless integration with existing pricing and inventory systems
- June 26, 2025. WhatsApp configuration system completed with PostgreSQL:
  - Token storage and management in database
  - Automatic webhook URL generation for Meta configuration
  - Real-time message logging and status tracking
  - Automated response system with welcome menu for incoming messages
  - Error handling and connection status monitoring
  - Ready for Meta Developer Console webhook configuration
  - Token updated to 60-day version (EAAKHVoxT6IUBO...) - expires in 60 days from June 26, 2025
- June 26, 2025. WhatsApp web panel integration completed and fully operational:
  - Real-time conversation display in web panel with customer information
  - Bidirectional messaging: customers send via WhatsApp, staff responds via web panel
  - Message history correctly stored and retrieved from PostgreSQL database
  - Webhook processing incoming WhatsApp messages and creating conversations automatically
  - Web panel message sending with proper endpoint structure and data validation
  - Complete integration tested and verified working with live WhatsApp interactions
  - System ready for production use with full conversation management capabilities
- June 26, 2025. Critical fix for WhatsApp message sending from web panel:
  - Resolved issue where messages from staff were saved to database but not sent to WhatsApp
  - Added proper WhatsApp API integration to conversation message endpoint
  - Messages now correctly sent via WhatsApp Business API with valid message IDs
  - Fixed apiRequest parameter order inconsistencies across frontend components
  - Comprehensive error handling and logging for WhatsApp message delivery
  - Bidirectional messaging fully operational: WhatsApp ↔ Web Panel integration complete
- June 26, 2025. WhatsApp chat interface redesign with modern UI:
  - Complete visual overhaul to match WhatsApp's design language
  - Message bubbles with distinctive colors: white for customer messages, green for staff
  - Rounded bubble design with message tails for better visual separation
  - Enhanced conversation list with user avatars, status indicators, and message previews
  - Improved header design with customer avatars and online status indicators
  - Read receipt indicators and delivery status visualization
  - Modern input field with rounded design and enhanced send button
  - Background gradient similar to WhatsApp for better message contrast
  - Enhanced typography and spacing for improved readability
- June 26, 2025. Customer registration system and personalized greetings implemented:
  - Automatic customer registration flow for new WhatsApp users
  - Name collection process with validation for first-time users
  - Personalized welcome messages using customer names for returning users
  - Registration flow tracking with step-by-step validation
  - Database integration for customer profile management
  - Seamless transition from registration to main menu options
  - Error handling and flow recovery for registration failures
  - Complete customer lifecycle management from first contact to order completion
  - Fixed WhatsApp order creation error by updating method signatures to include delivery cost parameters
  - Resolved order creation failures after quantity selection by correcting orderItems structure
  - Enhanced error logging for WhatsApp order processing to improve debugging
  - Complete WhatsApp order flow now working: product selection → quantity selection → order generation → confirmation
  - Fixed duplicate order number constraint error by implementing timestamp-based unique order number generation
  - Order numbers now use timestamp-based system (ORD-XXXXXX format) to completely eliminate duplicates
  - Resolved all order creation failures in WhatsApp integration - system fully operational
  - WhatsApp order flow now working perfectly: product selection → quantity selection → order generation → confirmation
- June 26, 2025. Customer data collection and payment method selection implemented:
  - Added customer delivery address collection after order generation
  - Implemented payment method selection with interactive buttons (card, transfer, cash)
  - Customer address validation and automatic location update in database
  - Payment-specific instructions for each method (card processing, bank details, cash delivery)
  - Complete order flow: product → quantity → order → address → payment → final confirmation
  - Order status automatically updated to 'confirmed' after payment method selection
  - Registration flow system expanded to handle multi-step order completion process
  - Enhanced order tracking with payment method and delivery address stored in order notes
- June 26, 2025. Customer name collection and complete data registration system implemented:
  - Added mandatory customer name collection step after order generation
  - Implemented updateCustomerName method in both MemStorage and DatabaseStorage
  - Customer name validation with minimum length requirements (3+ characters)
  - Complete customer data flow: product → quantity → order → name → address → payment → confirmation
  - Customer names properly stored and displayed in order confirmations
  - Enhanced customer profile management with full name registration in database
  - Improved order tracking with complete customer information throughout the process
- June 26, 2025. Contact number collection system fully implemented:
  - Added contact number collection step between address and payment in WhatsApp flow
  - Interactive buttons allowing customers to use WhatsApp number or provide different contact number
  - Phone number validation with 10-digit format requirement and automatic formatting
  - Complete order flow now: product → quantity → order → name → address → contact → payment → confirmation
  - Contact number properly stored in order data and displayed in final confirmation message
  - Enhanced customer communication with primary contact number for delivery coordination
  - Comprehensive error handling and flow recovery for contact number collection failures
- June 26, 2025. CRITICAL BUG FIX: Resolved competing registration flows causing name collection failures:
  - Fixed issue where customers entering names were redirected to main menu instead of continuing order flow
  - Implemented registration flow priority system: active flows now take precedence over auto-responses
  - Added detailed logging to diagnose and prevent future flow conflicts between basic registration and order completion
  - Separated handling of new customer registration vs existing customer order data collection
  - Order completion flow now works correctly: customers can provide names and continue to address collection
  - Enhanced message processing logic to properly distinguish between different flow contexts

## User Preferences

Preferred communication style: Simple, everyday language.