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

## User Preferences

Preferred communication style: Simple, everyday language.