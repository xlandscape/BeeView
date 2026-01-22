# BeeView Client

This is the frontend client for the BeeView application, built with React, Vite, and Electron. It provides an interactive map interface for visualizing bee foraging data.

## Setup Instructions

### Prerequisites

- Node.js 16 or higher
- npm (comes with Node.js)

### Installation

1. Navigate to the client directory:
   ```
   cd BeeView
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

### Running the Application

#### Development Mode (Web)

To start the development server, run:
```
npm run dev
```

The application will be available at `http://localhost:8081`.

#### Electron Desktop App (Development)

To run as an Electron desktop application in development mode:
```
npm run electron:dev
```

This requires the Vite dev server to be running (it uses `http://localhost:3000` internally).

#### Production Build

To build the application for production:
```
npm run build
```

This creates optimized files in the `dist/` directory.

#### Electron Build

To build the Electron desktop application:
```
npm run electron:build
```

For distribution:
```
npm run electron:dist
```

### Backend Server

The client requires the [BeeView server](https://github.com/xlandscape/BeeView-server) to be running to fetch data. Make sure the server is started before using the client:

1. Clone or navigate to the [server repository](https://github.com/xlandscape/BeeView-server)
2. Follow the [server setup instructions](https://github.com/xlandscape/BeeView-server/blob/main/README.md)
3. Start the server (typically on `http://localhost:32000`)

### Configuration

The client connects to the server at `http://localhost:32000` by default. If you need to change this, modify the API configuration in `src/config/api.js`.

### Features

- Interactive map visualization using MapLibre GL and Deck.gl
- Bee population charts and time series
- Land use and vegetation analysis
- Layer controls for different data overlays
- Sidebar with data panels

### Development

- The application uses Vite for fast development builds
- Redux Toolkit for state management
- D3.js for data visualization
- Turf.js for geospatial operations

### API Integration

The client communicates with the FastAPI backend server for:
- Shapefile and geospatial data
- Bee population statistics
- Nectar and pollen data
- Vegetation mapping

Refer to the server documentation for available endpoints.