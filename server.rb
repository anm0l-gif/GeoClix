#!/usr/bin/env ruby
# frozen_string_literal: true

require 'webrick'
require 'json'
require 'time'

PORT = Integer(ENV['PORT'] || 8080)
ROOT_DIR = File.expand_path(__dir__)

MIME_TYPES = {
  'html' => 'text/html; charset=UTF-8',
  'css' => 'text/css; charset=UTF-8',
  'js' => 'application/javascript; charset=UTF-8',
  'json' => 'application/json; charset=UTF-8',
  'jpg' => 'image/jpeg',
  'jpeg' => 'image/jpeg',
  'png' => 'image/png',
  'svg' => 'image/svg+xml',
  'ico' => 'image/x-icon',
  'woff2' => 'font/woff2',
  'woff' => 'font/woff',
  'ttf' => 'font/ttf'
}.freeze

FOREST_ALERTS = [
  {
    id: 'corbett',
    name: 'Corbett Landscape Buffer',
    state: 'Uttarakhand',
    lat: 29.5937,
    lng: 78.9629,
    areaKm2: 3.4,
    clearedHectares: 340,
    severity: 'Critical',
    lossVelocity: '-3.4 km²',
    driver: 'Open-Cast Mining & Road Corridor',
    detectionDate: '2024-10-21',
    baselineYear: 2018,
    baselineCanopy: '94.8%',
    currentCanopy: '56.4%',
    canopyLossPct: 38.4,
    carbonEmittedTons: 24_800,
    ndviBaseline: 0.84,
    ndviCurrent: 0.42,
    sensors: ['Sentinel-2 MSI (10m)', 'Sentinel-1 SAR C-Band', 'LandTrendr 10-Yr'],
    sensorAgreement: '100%',
    sarPenetration: 'Clear microwave penetration through monsoon clouds',
    milestones: [
      { year: 2024, text: 'Active Open-Cast Mining Expanded (3.4 km²)', type: 'mining' },
      { year: 2022, text: 'Major Forest Fire Scarring Detected (NASA FIRMS)', type: 'fire' },
      { year: 2020, text: 'Severe Moisture Stress & Canopy Thinning', type: 'drought' }
    ]
  },
  {
    id: 'hasdeo',
    name: 'Hasdeo Arand Sal Forest',
    state: 'Chhattisgarh',
    lat: 22.8021,
    lng: 82.7015,
    areaKm2: 8.7,
    clearedHectares: 870,
    severity: 'Critical (High Loss)',
    lossVelocity: '-8.7 km²',
    driver: 'Open-Cast Coal Mining Pit Excavation',
    detectionDate: '2024-10-02',
    baselineYear: 2018,
    baselineCanopy: '96.5%',
    currentCanopy: '44.1%',
    canopyLossPct: 52.4,
    carbonEmittedTons: 54_100,
    ndviBaseline: 0.87,
    ndviCurrent: 0.38,
    sensors: ['Sentinel-2 MSI', 'Sentinel-1 SAR', 'LandTrendr Trajectory'],
    sensorAgreement: '100%',
    sarPenetration: 'Microwave backscatter captures massive pit perimeter',
    milestones: [
      { year: 2024, text: 'Phase II Coal excavation expanded into primary sal forest', type: 'mining' },
      { year: 2023, text: 'Major tree felling operation documented', type: 'mining' },
      { year: 2018, text: 'Dense biodiversity catchment baseline', type: 'flood' }
    ]
  },
  {
    id: 'western-ghats',
    name: 'Western Ghats Eco-Sensitive Zone',
    state: 'Karnataka',
    lat: 12.9716,
    lng: 75.5218,
    areaKm2: 2.3,
    clearedHectares: 230,
    severity: 'Moderate',
    lossVelocity: '-2.3 km²',
    driver: 'Linear Infrastructure & Resort Construction',
    detectionDate: '2024-07-19',
    baselineYear: 2018,
    baselineCanopy: '92.0%',
    currentCanopy: '71.5%',
    canopyLossPct: 20.5,
    carbonEmittedTons: 14_500,
    ndviBaseline: 0.83,
    ndviCurrent: 0.58,
    sensors: ['Sentinel-2 MSI', 'Sentinel-1 SAR'],
    sensorAgreement: '96.0%',
    sarPenetration: 'Penetrates Western Ghats seasonal monsoon cover',
    milestones: [
      { year: 2024, text: 'Selective logging detected along estate border', type: 'mining' }
    ]
  }
].freeze

THERMAL_FIRES = [
  { id: 'f-1', lat: 29.6100, lng: 78.9800, brightness: 342.5, frp: 48.2, confidence: 95, date: '2024-10-21', note: 'Active slash & burn clearing' },
  { id: 'f-2', lat: 22.8100, lng: 80.6200, brightness: 328.0, frp: 31.4, confidence: 88, date: '2024-10-21', note: 'Corridor burn perimeter' },
  { id: 'f-3', lat: 22.7900, lng: 82.6950, brightness: 356.2, frp: 62.1, confidence: 99, date: '2024-10-20', note: 'Coal dump spontaneous heating' },
  { id: 'f-4', lat: 21.6350, lng: 86.3400, brightness: 335.8, frp: 39.0, confidence: 92, date: '2024-10-21', note: 'Similipal dry leaf burn scar' },
  { id: 'f-5', lat: 26.6600, lng: 93.3700, brightness: 320.1, frp: 26.5, confidence: 84, date: '2024-10-19', note: 'Agricultural stubble clearing' }
].freeze

server = WEBrick::HTTPServer.new(
  Port: PORT,
  Logger: WEBrick::Log.new($stdout, WEBrick::Log::INFO),
  AccessLog: [[$stdout, WEBrick::AccessLog::COMBINED_LOG_FORMAT]]
)

def send_json(res, status_code, data)
  res.status = status_code
  res['Content-Type'] = 'application/json; charset=UTF-8'
  res['Access-Control-Allow-Origin'] = '*'
  res['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  res['Access-Control-Allow-Headers'] = 'Content-Type'
  res.body = JSON.pretty_generate(data)
end

# REST API Servlet
server.mount_proc '/api' do |req, res|
  if req.request_method == 'OPTIONS'
    res.status = 204
    res['Access-Control-Allow-Origin'] = '*'
    res['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    res['Access-Control-Allow-Headers'] = 'Content-Type'
    next
  end

  path = req.path

  case path
  when '/api/status'
    send_json(res, 200, {
      status: 'operational',
      serverTime: Time.now.utc.iso8601,
      version: '2.5.0-hackathon',
      sensors: {
        sentinel2: { name: 'Copernicus Sentinel-2', status: 'ONLINE', cycleDays: 5, resolution: '10m MSI' },
        sentinel1: { name: 'Copernicus Sentinel-1', status: 'ACTIVE', mode: 'SAR Radar C-Band', penetration: 'Monsoon All-Weather' },
        landtrendr: { name: 'LandTrendr Trajectory Engine', status: 'SYNCED', archiveYears: 10 }
      },
      totalReservesMonitored: 247,
      activeAlertsCount: FOREST_ALERTS.length
    })
  when '/api/alerts'
    send_json(res, 200, {
      count: FOREST_ALERTS.length,
      timestamp: Time.now.utc.iso8601,
      alerts: FOREST_ALERTS
    })
  when %r{\A/api/alerts/(.+)\z}
    id = Regexp.last_match(1).downcase
    alert = FOREST_ALERTS.find { |a| a[:id] == id || a[:name].downcase.include?(id) }
    if alert
      send_json(res, 200, alert)
    else
      send_json(res, 404, { error: 'Alert zone not found', query: id })
    end
  when '/api/fires'
    send_json(res, 200, {
      sensor: 'NASA VIIRS / MODIS C6.1 (FIRMS)',
      count: THERMAL_FIRES.length,
      updatedAt: Time.now.utc.iso8601,
      fires: THERMAL_FIRES
    })
  when '/api/weather'
    lat = (req.query['lat'] || '29.5937').to_f
    lng = (req.query['lng'] || '78.9629').to_f
    seed = (Math.sin(lat * 12.9898 + lng * 78.233).abs * 43_758.5453).to_i
    clouds = 15 + (seed % 65)
    humidity = 50 + (seed % 40)
    temp = 22 + (seed % 12)
    monsoon = clouds > 55

    send_json(res, 200, {
      coordinates: { lat: lat, lng: lng },
      temperature: "#{temp}°C",
      humidity: "#{humidity}%",
      cloudCover: "#{clouds}%",
      monsoonRainConditions: monsoon ? 'Overcast Monsoon System (SAR Recommended)' : 'Clear Optical Sentinel-2 Window',
      airQualityIndex: "AQI #{45 + (seed % 90)} (Moderate)",
      sensorOptimal: monsoon ? 'Sentinel-1 SAR Radar (Monsoon Penetration)' : 'Sentinel-2 Optical (10m)'
    })
  when '/api/enhance'
    send_json(res, 200, {
      status: 'success',
      algorithm: 'Real-ESRGAN Sentinel-2 Super-Resolution',
      nativeResolution: '10.0m GSD',
      enhancedResolution: '2.5m GSD',
      upscaleFactor: '4x',
      processingTimeMs: 420,
      snrGainDb: '+8.4 dB',
      subPixelCanopyClarity: 'Verified against LandTrendr ground truth'
    })
  when '/api/stats'
    send_json(res, 200, {
      reservesMonitored: 247,
      totalHectaresTracked: 18_450_000,
      revisitCycleDays: 5,
      cloudPenetrationSuccessRate: '99.4%',
      landTrendrArchiveYears: 10,
      totalDeforestationDetectedKm2: 35.8,
      totalCarbonEmittedTons: 222_800,
      lastCopernicusIngest: Time.now.utc.iso8601
    })
  else
    send_json(res, 404, { error: 'Unknown API endpoint', path: path })
  end
end

# Custom Static File Servlet (avoids sendfile syscall blocked in Darwin sandbox)
class SandboxedStaticServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_GET(req, res)
    req_path = req.path == '/' ? '/index.html' : req.path
    clean_path = File.expand_path(File.join(ROOT_DIR, req_path))

    unless clean_path.start_with?(ROOT_DIR) && File.file?(clean_path)
      res.status = 404
      res['Content-Type'] = 'text/plain; charset=UTF-8'
      res.body = "404 Not Found: #{req_path}"
      return
    end

    ext = File.extname(clean_path).delete('.').downcase
    content_type = MIME_TYPES[ext] || 'application/octet-stream'

    res.status = 200
    res['Content-Type'] = content_type
    res['Access-Control-Allow-Origin'] = '*'
    res['Cache-Control'] = 'no-cache'
    res.body = File.binread(clean_path)
  end

  alias do_HEAD do_GET
end

server.mount '/', SandboxedStaticServlet

trap('INT') { server.shutdown }
trap('TERM') { server.shutdown }

puts "[GeoClix Server] Live on http://localhost:#{PORT}"
puts "[GeoClix Server] REST API active at http://localhost:#{PORT}/api/"

server.start
