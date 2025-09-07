// Global variables
let currentLocation = null;
let weatherData = null;

// DOM elements
const roofAreaInput = document.getElementById('roofArea');
const openSpaceInput = document.getElementById('openSpace');
const locationInput = document.getElementById('location');
const autoFetchBtn = document.getElementById('autoFetch');
const rainfallDisplay = document.getElementById('rainfall');
const aquiferDisplay = document.getElementById('aquifer');
const groundwaterDisplay = document.getElementById('groundwater');
const waterVolumeDisplay = document.getElementById('waterVolume');
const rechargeStructureDisplay = document.getElementById('rechargeStructure');
const dimensionsDisplay = document.getElementById('dimensions');
const costBenefitBtn = document.getElementById('costBenefitBtn');
const downloadBtn = document.getElementById('downloadBtn');
const modal = document.getElementById('costBenefitModal');
const closeModal = document.querySelector('.close');

// Water harvesting calculations
class WaterHarvestingCalculator {
    constructor() {
        this.runoffCoefficient = 0.8; // Typical for roofs
        this.openSpaceCoefficient = 0.4; // Typical for open spaces
        this.efficiencyFactor = 0.9; // Collection efficiency
    }

    calculateWaterVolume(roofArea, openSpace, annualRainfall) {
        if (!roofArea && !openSpace || !annualRainfall) return 0;
        
        const roofCollection = (roofArea || 0) * annualRainfall * this.runoffCoefficient;
        const openSpaceCollection = (openSpace || 0) * annualRainfall * this.openSpaceCoefficient;
        
        // Convert mm*m² to liters (1 mm over 1 m² = 1 liter)
        const totalCollection = (roofCollection + openSpaceCollection) * this.efficiencyFactor;
        
        return Math.round(totalCollection);
    }

    getRecommendation(totalArea, waterVolume, groundwaterDepth) {
        if (!totalArea || totalArea === 0) return { structure: '--', dimensions: '--' };
        
        let structure, dimensions;
        
        if (totalArea < 50) {
            structure = 'Rain Barrel';
            dimensions = '1 m × 1 m × 1.5 m';
        } else if (totalArea < 200) {
            structure = 'Percolation Tank';
            dimensions = '2 m × 2 m × 2 m';
        } else if (totalArea < 500) {
            structure = 'Recharge Well';
            dimensions = '3 m × 3 m × 4 m';
        } else {
            structure = 'Recharge Pond';
            dimensions = '5 m × 5 m × 3 m';
        }

        // Adjust for groundwater depth
        if (groundwaterDepth && groundwaterDepth < 5) {
            structure = 'Surface Storage Tank';
        } else if (groundwaterDepth && groundwaterDepth > 20) {
            structure = 'Deep Recharge Well';
            dimensions = dimensions.replace(/× \d+ m$/, '× 6 m');
        }

        return { structure, dimensions };
    }

    calculateCostBenefit(waterVolume, totalArea) {
        // Basic cost calculations (in USD)
        const costPerSquareMeter = totalArea < 100 ? 50 : totalArea < 300 ? 40 : 30;
        const initialCost = totalArea * costPerSquareMeter;
        
        // Water savings calculation (assuming $2 per 1000 liters)
        const annualSavings = (waterVolume / 1000) * 2;
        const paybackPeriod = annualSavings > 0 ? Math.round(initialCost / annualSavings * 10) / 10 : 0;
        const twentyYearSavings = annualSavings * 20;
        const roi = initialCost > 0 ? Math.round(((twentyYearSavings - initialCost) / initialCost) * 100) : 0;

        return {
            initialCost,
            annualSavings,
            paybackPeriod,
            roi
        };
    }
}

// Weather and location services
class LocationService {
    constructor() {
        this.calculator = new WaterHarvestingCalculator();
    }

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser.'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const locationName = await this.reverseGeocode(latitude, longitude);
                        const weather = await this.getWeatherData(latitude, longitude);
                        
                        resolve({
                            name: locationName,
                            coordinates: { latitude, longitude },
                            weather: weather
                        });
                    } catch (error) {
                        resolve({
                            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                            coordinates: { latitude, longitude },
                            weather: this.getDummyWeatherData()
                        });
                    }
                },
                (error) => {
                    reject(error);
                },
                { timeout: 10000, maximumAge: 300000 }
            );
        });
    }

    async reverseGeocode(lat, lon) {
        try {
            // Using a free geocoding service
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            const data = await response.json();
            return data.city ? `${data.city}, ${data.countryName}` : `${data.locality}, ${data.countryName}`;
        } catch (error) {
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
    }

    async getWeatherData(lat, lon) {
        // For a real application, you would use services like OpenWeatherMap API
        // For demo purposes, we'll return simulated data based on coordinates
        return this.getDummyWeatherData(lat, lon);
    }

    getDummyWeatherData(lat = 0, lon = 0) {
        // Generate realistic weather data based on location
        const baseRainfall = Math.abs(lat) < 30 ? 800 + Math.random() * 1200 : 400 + Math.random() * 600;
        const rainfall = Math.round(baseRainfall);
        
        const aquiferPresence = Math.random() > 0.3 ? 'Yes' : 'No';
        const groundwaterDepth = Math.round(5 + Math.random() * 25);

        return {
            annualRainfall: rainfall,
            aquiferPresence: aquiferPresence,
            groundwaterDepth: groundwaterDepth
        };
    }
}

// App controller
class WaterHarvestingApp {
    constructor() {
        this.calculator = new WaterHarvestingCalculator();
        this.locationService = new LocationService();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateCalculations();
    }

    setupEventListeners() {
        // Input change listeners for real-time calculations
        roofAreaInput.addEventListener('input', () => this.updateCalculations());
        openSpaceInput.addEventListener('input', () => this.updateCalculations());

        // Auto fetch location
        autoFetchBtn.addEventListener('click', () => this.autoFetchLocation());

        // Cost benefit modal
        costBenefitBtn.addEventListener('click', () => this.showCostBenefitAnalysis());
        closeModal.addEventListener('click', () => this.closeCostBenefitModal());
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeCostBenefitModal();
            }
        });

        // Download report
        downloadBtn.addEventListener('click', () => this.downloadReport());

        // Language selector (basic implementation)
        document.getElementById('language').addEventListener('change', (e) => {
            this.changeLanguage(e.target.value);
        });
    }

    async autoFetchLocation() {
        autoFetchBtn.disabled = true;
        autoFetchBtn.innerHTML = '📍 Fetching...';

        try {
            currentLocation = await this.locationService.getCurrentLocation();
            locationInput.value = currentLocation.name;
            weatherData = currentLocation.weather;
            
            this.updateWeatherDisplay();
            this.updateCalculations();
            
            autoFetchBtn.innerHTML = '📍 Auto Fetch';
            autoFetchBtn.disabled = false;
        } catch (error) {
            console.error('Error fetching location:', error);
            alert('Unable to fetch location. Please check your browser permissions and try again.');
            autoFetchBtn.innerHTML = '📍 Auto Fetch';
            autoFetchBtn.disabled = false;
            
            // Use default weather data
            weatherData = this.locationService.getDummyWeatherData();
            locationInput.value = 'Location not detected';
            this.updateWeatherDisplay();
            this.updateCalculations();
        }
    }

    updateWeatherDisplay() {
        if (weatherData) {
            rainfallDisplay.textContent = `${weatherData.annualRainfall} mm/yr`;
            aquiferDisplay.textContent = weatherData.aquiferPresence;
            groundwaterDisplay.textContent = `${weatherData.groundwaterDepth} m`;
        }
    }

    updateCalculations() {
        const roofArea = parseFloat(roofAreaInput.value) || 0;
        const openSpace = parseFloat(openSpaceInput.value) || 0;
        const totalArea = roofArea + openSpace;
        
        if (!weatherData) {
            waterVolumeDisplay.textContent = '0';
            rechargeStructureDisplay.textContent = '--';
            dimensionsDisplay.textContent = '--';
            return;
        }

        const waterVolume = this.calculator.calculateWaterVolume(
            roofArea, 
            openSpace, 
            weatherData.annualRainfall
        );

        const recommendation = this.calculator.getRecommendation(
            totalArea, 
            waterVolume, 
            weatherData.groundwaterDepth
        );

        // Animate water volume change
        this.animateNumber(waterVolumeDisplay, parseInt(waterVolumeDisplay.textContent) || 0, waterVolume);
        
        rechargeStructureDisplay.textContent = recommendation.structure;
        dimensionsDisplay.textContent = recommendation.dimensions;
    }

    animateNumber(element, start, end, duration = 1000) {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                element.textContent = Math.round(end).toLocaleString();
                clearInterval(timer);
            } else {
                element.textContent = Math.round(current).toLocaleString();
            }
        }, 16);
    }

    showCostBenefitAnalysis() {
        const roofArea = parseFloat(roofAreaInput.value) || 0;
        const openSpace = parseFloat(openSpaceInput.value) || 0;
        const totalArea = roofArea + openSpace;
        const waterVolume = parseInt(waterVolumeDisplay.textContent.replace(/,/g, '')) || 0;

        const analysis = this.calculator.calculateCostBenefit(waterVolume, totalArea);

        document.getElementById('initialCost').textContent = `Rs.${analysis.initialCost.toLocaleString()}`;
        document.getElementById('annualSavings').textContent = `Rs.${analysis.annualSavings.toLocaleString()}`;
        document.getElementById('paybackPeriod').textContent = `${analysis.paybackPeriod} years`;
        document.getElementById('roi').textContent = `${analysis.roi}%`;

        modal.style.display = 'block';
    }

    closeCostBenefitModal() {
        modal.style.display = 'none';
    }

    downloadReport() {
        const data = this.generateReportData();
        this.createPDFReport(data);
    }

    generateReportData() {
        const roofArea = parseFloat(roofAreaInput.value) || 0;
        const openSpace = parseFloat(openSpaceInput.value) || 0;
        const totalArea = roofArea + openSpace;
        const waterVolume = parseInt(waterVolumeDisplay.textContent.replace(/,/g, '')) || 0;
        const structure = rechargeStructureDisplay.textContent;
        const dimensions = dimensionsDisplay.textContent;

        return {
            location: locationInput.value || 'Not specified',
            roofArea,
            openSpace,
            totalArea,
            waterVolume,
            rainfall: weatherData ? weatherData.annualRainfall : 0,
            aquifer: weatherData ? weatherData.aquiferPresence : 'Unknown',
            groundwater: weatherData ? weatherData.groundwaterDepth : 0,
            structure,
            dimensions,
            generatedAt: new Date().toLocaleString()
        };
    }

    createPDFReport(data) {
        // Simple text-based report (in a real app, you'd use a PDF library like jsPDF)
        const reportContent = `
WATER HARVESTING REPORT
Generated: ${data.generatedAt}

LOCATION INFORMATION
Location: ${data.location}
Annual Rainfall: ${data.rainfall} mm/year
Aquifer Presence: ${data.aquifer}
Groundwater Depth: ${data.groundwater} m

AREA CALCULATIONS
Roof Area: ${data.roofArea} m²
Open Space: ${data.openSpace} m²
Total Area: ${data.totalArea} m²

WATER HARVESTING POTENTIAL
Estimated Annual Collection: ${data.waterVolume.toLocaleString()} liters

RECOMMENDATIONS
Recommended Structure: ${data.structure}
Suggested Dimensions: ${data.dimensions}

This report provides an estimate based on the provided information. 
Actual results may vary based on local conditions and implementation quality.
        `;

        // Create downloadable text file
        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `water-harvesting-report-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    changeLanguage(language) {
        // Basic language support (in a real app, you'd have proper i18n)
        const translations = {
            en: {
                title: 'Water Harvesting Made Easy',
                roofArea: 'Roof Area',
                openSpace: 'Open Space',
                location: 'Location',
                autoFetch: '📍 Auto Fetch',
                automaticDetected: 'Automatic Detected',
                rainfall: 'Rainfall',
                aquifer: 'Aquifer Presence',
                groundwater: 'Groundwater Depth',
                waterVolume: 'Water volume',
                recommendations: 'Recommendations',
                rechargeStructure: 'Recharge Structure',
                dimensions: 'Dimensions',
                downloadReport: '📥 Download Report (PDF)'
            },
            es: {
                title: 'Cosecha de Agua Fácil',
                roofArea: 'Área del Techo',
                openSpace: 'Espacio Abierto',
                location: 'Ubicación',
                autoFetch: '📍 Auto Obtener',
                automaticDetected: 'Detectado Automáticamente',
                rainfall: 'Precipitación',
                aquifer: 'Presencia de Acuífero',
                groundwater: 'Profundidad del Agua Subterránea',
                waterVolume: 'Volumen de agua',
                recommendations: 'Recomendaciones',
                rechargeStructure: 'Estructura de Recarga',
                dimensions: 'Dimensiones',
                downloadReport: '📥 Descargar Informe (PDF)'
            }
        };

        // This is a simplified implementation - in a real app you'd update all text elements
        console.log(`Language changed to: ${language}`);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WaterHarvestingApp();
});

// Add some sample data on page load for demonstration
window.addEventListener('load', () => {
    // Simulate auto-detected data for demo
    setTimeout(() => {
        if (!currentLocation) {
            weatherData = {
                annualRainfall: 650,
                aquiferPresence: 'Yes',
                groundwaterDepth: 12
            };
            locationInput.value = 'Sample Location';
            rainfallDisplay.textContent = '650 mm/yr';
            aquiferDisplay.textContent = 'Yes';
            groundwaterDisplay.textContent = '12 m';
        }
    }, 1000);
});
