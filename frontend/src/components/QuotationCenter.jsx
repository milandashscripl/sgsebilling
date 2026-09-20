import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { downloadQuotationPdf } from '../utils/quotationPdf';
import LoadingState from './LoadingState';

const api = axios.create({ baseURL: API_BASE_URL });
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const initialForm = {
  clientName: '', clientContact: '', clientEmail: '', clientAddress: '', siteName: 'Bargarh, Odisha', latitude: '21.333', longitude: '83.617', solarResource: '',
  segment: 'Residential', systemType: 'On-grid', capacity: '5', panelWattage: '550', panelCount: '10', roofLength: '8', roofWidth: '5', tilt: '20', azimuth: '180', shading: '5',
  tariff: '5', projectCost: '325000', gstRate: '0', centralSubsidy: '78000', stateSubsidy: '60000', financePercent: '80', interestRate: '6', tenureYears: '10',
  roofSurface: 'Flat RCC roof', panelLayout: 'Portrait', panelGap: '0.04', rowSpacing: '0.8', mountingHeight: '0.35',
  panelBrand: 'Waaree', inverterBrand: 'Growatt', batteryType: 'None', batteryBrand: 'Eastman', batteryKwh: '5', notes: ''
};

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, number(value, min)));
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(number(value));
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '-';
const getToken = () => localStorage.getItem('token');

function calculate(form) {
  const capacity = number(form.capacity, 5);
  const solarResource = form.solarResource ? number(form.solarResource, 5.2) : 5.2;
  const annualGeneration = capacity * solarResource * 365 * (1 - 0.14) * (1 - clamp(form.shading, 0, 100) / 100);
  const annualValue = annualGeneration * number(form.tariff, 5);
  const cost = number(form.projectCost);
  const subsidy = number(form.centralSubsidy) + number(form.stateSubsidy);
  const financed = cost * number(form.financePercent, 80) / 100;
  const monthlyRate = number(form.interestRate, 6) / 100 / 12;
  const monthsCount = Math.max(1, number(form.tenureYears, 10) * 12);
  const emi = monthlyRate ? financed * monthlyRate * ((1 + monthlyRate) ** monthsCount) / (((1 + monthlyRate) ** monthsCount) - 1) : financed / monthsCount;
  return { capacity, annualGeneration, annualValue, cost, subsidy, financed, emi, payback: Math.max(0, cost - subsidy) / Math.max(annualValue, 1), monthsCount };
}

const SEASON_PRESETS = {
  Winter: { day: 355, label: '21 Dec' },
  Spring: { day: 80, label: '21 Mar' },
  Summer: { day: 172, label: '21 Jun' },
  Autumn: { day: 266, label: '23 Sep' }
};

function solarPosition(latitude, day, hour) {
  const radians = Math.PI / 180;
  const lat = clamp(latitude, -66, 66) * radians;
  const declination = (23.45 * Math.sin(radians * (360 / 365) * (day - 81))) * radians;
  const hourAngle = (hour - 12) * 15 * radians;
  const altitude = Math.asin(Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle));
  const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat));
  return { altitude: altitude / radians, azimuth: (azimuth / radians + 180 + 360) % 360 };
}

const siteMeters = (latitude, longitude, centerLatitude, centerLongitude) => ({
  x: (longitude - centerLongitude) * 111320 * Math.cos(THREE.MathUtils.degToRad(centerLatitude)),
  z: -(latitude - centerLatitude) * 110540
});

const longitudeToTile = (longitude, zoom) => Math.floor(((longitude + 180) / 360) * (2 ** zoom));
const latitudeToTile = (latitude, zoom) => Math.floor((1 - Math.asinh(Math.tan(THREE.MathUtils.degToRad(latitude))) / Math.PI) / 2 * (2 ** zoom));
const aerialTileUrl = (latitude, longitude, zoom = 19) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${latitudeToTile(latitude, zoom)}/${longitudeToTile(longitude, zoom)}`;

async function fetchSiteContext(latitude, longitude, signal) {
  const centerLatitude = number(latitude, 21.333);
  const centerLongitude = number(longitude, 83.617);
  const query = `[out:json][timeout:12];way(around:90,${centerLatitude},${centerLongitude})[building];out geom;`;
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) throw new Error('Site map unavailable');
  const data = await response.json();
  const buildings = (data.elements || []).map((element) => {
    const points = (element.geometry || []).map((point) => siteMeters(point.lat, point.lon, centerLatitude, centerLongitude));
    const centroid = points.reduce((center, point) => ({ x: center.x + point.x / Math.max(points.length, 1), z: center.z + point.z / Math.max(points.length, 1) }), { x: 0, z: 0 });
    const levels = number(element.tags?.['building:levels'], 1);
    return { id: element.id, points, centroid, height: Math.max(2.8, levels * 3), tags: element.tags || {} };
  }).filter((building) => building.points.length >= 3);
  const target = buildings.sort((left, right) => (left.centroid.x ** 2 + left.centroid.z ** 2) - (right.centroid.x ** 2 + right.centroid.z ** 2))[0] || null;
  const targetBounds = target ? target.points.reduce((bounds, point) => ({ minX: Math.min(bounds.minX, point.x), maxX: Math.max(bounds.maxX, point.x), minZ: Math.min(bounds.minZ, point.z), maxZ: Math.max(bounds.maxZ, point.z) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }) : null;
  return { buildings, targetId: target?.id || null, targetHeight: target?.height || 2.8, targetCentroid: target?.centroid || { x: 0, z: 0 }, targetBounds, latitude: centerLatitude, longitude: centerLongitude };
}

function seasonalGeneration(form, seasonName) {
  const base = calculate(form).annualGeneration / 12;
  const factors = { Winter: 0.82, Spring: 1.03, Summer: 1.16, Autumn: 0.99 };
  return base * (factors[seasonName] || 1);
}

function ThreeDPreview({ form }) {
  const previewRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const plantRef = useRef(null);
  const mapRef = useRef(null);
  const sunRef = useRef(null);
  const sunMarkerRef = useRef(null);
  const [season, setSeason] = useState('Summer');
  const [hour, setHour] = useState(12);
  const [localSiteContext, setLocalSiteContext] = useState({ buildings: [], targetId: null });
  useEffect(() => {
    const latitude = number(form.latitude);
    const longitude = number(form.longitude);
    if (!latitude || !longitude) return undefined;
    const controller = new AbortController();
    fetchSiteContext(latitude, longitude, controller.signal).then(setLocalSiteContext).catch((error) => {
      if (error.name !== 'AbortError') setLocalSiteContext({ buildings: [], targetId: null });
    });
    return () => controller.abort();
  }, [form.latitude, form.longitude]);
  const toggleFullscreen = async () => { if (!document.fullscreenElement) await previewRef.current?.requestFullscreen?.(); else await document.exitFullscreen?.(); };
  const count = Math.max(1, Math.min(200, Math.round(number(form.panelCount, 10))));
    useEffect(() => {
    const host = sceneRef.current;
    if (!host) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07141b');
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 1000);
    camera.position.set(11, 9, 14);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    host.replaceChildren(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    scene.add(new THREE.HemisphereLight('#eafaff', '#132b38', 1.7));
    const sun = new THREE.DirectionalLight('#fff4d0', 2.8);
    sun.position.set(8, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
    scene.add(sun); scene.add(sun.target);
    const sunMarker = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), new THREE.MeshBasicMaterial({ color: '#ffd56a' }));
    scene.add(sunMarker);
    const mapMaterial = new THREE.MeshBasicMaterial({ color: '#263b40', side: THREE.DoubleSide });
    const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), mapMaterial);
    mapPlane.rotation.x = -Math.PI / 2;
    mapPlane.position.y = -0.22;
    scene.add(mapPlane);
    const plant = new THREE.Group();
    scene.add(plant);
    rendererRef.current = renderer; cameraRef.current = camera; controlsRef.current = controls; plantRef.current = plant; mapRef.current = mapPlane; sunRef.current = sun; sunMarkerRef.current = sunMarker;
    const resize = () => { if (!host.clientWidth || !host.clientHeight) return; camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); };
    window.addEventListener('resize', resize);
    let frame = 0;
    const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate(); resize();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); controls.dispose(); mapMaterial.map?.dispose?.(); mapMaterial.dispose(); mapPlane.geometry.dispose(); renderer.dispose(); host.replaceChildren(); };
  }, []);
  useEffect(() => {
    const mapPlane = mapRef.current;
    const latitude = number(form.latitude);
    const longitude = number(form.longitude);
    if (!mapPlane || !latitude || !longitude) return undefined;
    const zoom = 19;
    const tileMeters = 40075016.686 * Math.cos(THREE.MathUtils.degToRad(latitude)) / (2 ** zoom);
    const scale = 2 ** zoom;
    const fractionalX = (((longitude + 180) / 360) * scale) % 1;
    const fractionalY = ((1 - Math.asinh(Math.tan(THREE.MathUtils.degToRad(latitude))) / Math.PI) / 2 * scale) % 1;
    mapPlane.geometry.dispose();
    mapPlane.geometry = new THREE.PlaneGeometry(tileMeters, tileMeters);
    mapPlane.position.x = (0.5 - fractionalX) * tileMeters;
    mapPlane.position.z = (fractionalY - 0.5) * tileMeters;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const texture = loader.load(aerialTileUrl(latitude, longitude, zoom), () => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    });
    const material = mapPlane.material;
    material.map?.dispose?.();
    material.map = texture;
    material.color.set('#ffffff');
    material.needsUpdate = true;
    return () => texture.dispose();
  }, [form.latitude, form.longitude]);
  useEffect(() => {
    const sun = sunRef.current;
    const marker = sunMarkerRef.current;
    if (!sun || !marker) return;
    const position = solarPosition(number(form.latitude, 21.333), SEASON_PRESETS[season].day, hour);
    const altitude = THREE.MathUtils.degToRad(Math.max(8, position.altitude));
    const azimuth = THREE.MathUtils.degToRad(position.azimuth);
    const radius = 15;
    const x = Math.sin(azimuth) * Math.cos(altitude) * radius;
    const y = Math.sin(altitude) * radius;
    const z = Math.cos(azimuth) * Math.cos(altitude) * radius;
    sun.position.set(x, y, z);
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
    marker.position.set(x, y, z);
    sun.intensity = Math.max(0.7, 2.2 * Math.sin(altitude));
  }, [form.latitude, season, hour]);
  useEffect(() => {
    const plant = plantRef.current;
    if (!plant) return;
    while (plant.children.length) { const child = plant.children.pop(); child.traverse((node) => { node.geometry?.dispose?.(); node.material?.dispose?.(); }); }
    const roofLength = Math.max(2, number(form.roofLength, 8));
    const roofWidth = Math.max(2, number(form.roofWidth, 5));
    const mappedRoofHeight = localSiteContext?.targetId ? Math.max(2.8, number(localSiteContext.targetHeight, 2.8)) : 0;
    const installX = 0;
    const installZ = 0;
    const mappedLength = localSiteContext?.targetBounds ? Math.max(2, localSiteContext.targetBounds.maxX - localSiteContext.targetBounds.minX) : roofLength;
    const mappedWidth = localSiteContext?.targetBounds ? Math.max(2, localSiteContext.targetBounds.maxZ - localSiteContext.targetBounds.minZ) : roofWidth;
    const effectiveRoofLength = localSiteContext?.targetId ? Math.min(roofLength, mappedLength * 0.88) : roofLength;
    const effectiveRoofWidth = localSiteContext?.targetId ? Math.min(roofWidth, mappedWidth * 0.88) : roofWidth;
    const tilt = THREE.MathUtils.degToRad(clamp(form.tilt, 0, 45));
    const azimuth = THREE.MathUtils.degToRad(number(form.azimuth, 180) - 180);
    const panelW = form.panelLayout === 'Landscape' ? 2.1 : 1.1;
    const panelD = form.panelLayout === 'Landscape' ? 1.1 : 2.1;
    const gap = Math.max(0.02, number(form.panelGap, 0.04));
    const rowSpacing = Math.max(0.25, number(form.rowSpacing, 0.8));
    const height = Math.max(0.12, number(form.mountingHeight, 0.35));
    const columns = Math.max(1, Math.min(Math.ceil(Math.sqrt(count * roofLength / roofWidth)), Math.floor(roofLength / (panelW + gap))));
    const rows = Math.max(1, Math.ceil(count / columns));
    const roof = new THREE.Mesh(new THREE.BoxGeometry(effectiveRoofLength, 0.12, effectiveRoofWidth), new THREE.MeshStandardMaterial({ color: '#657477', roughness: 0.82 }));
    roof.position.set(installX, mappedRoofHeight + 0.02, installZ); roof.rotation.y = azimuth; roof.receiveShadow = true; plant.add(roof);
    const installMarker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 32), new THREE.MeshBasicMaterial({ color: '#ffcf57', side: THREE.DoubleSide }));
    installMarker.rotation.x = -Math.PI / 2;
    installMarker.position.set(installX, mappedRoofHeight + 0.11, installZ);
    plant.add(installMarker);
    const siteGroup = new THREE.Group();
    (localSiteContext?.buildings || []).forEach((building) => {
      const shape = new THREE.Shape();
      building.points.forEach((point, index) => {
        if (index === 0) shape.moveTo(point.x, -point.z);
        else shape.lineTo(point.x, -point.z);
      });
      shape.closePath();
      const mesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false }),
        new THREE.MeshStandardMaterial({ color: building.id === localSiteContext.targetId ? '#8d9da0' : '#4d6269', roughness: 0.88, metalness: 0.02 })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -0.15;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      siteGroup.add(mesh);
    });
    plant.add(siteGroup);
    const panelMaterial = new THREE.MeshPhysicalMaterial({ color: '#0b4262', metalness: 0.62, roughness: 0.18, clearcoat: 0.7, clearcoatRoughness: 0.12, emissive: '#031924', emissiveIntensity: 0.2 });
    const frameMaterial = new THREE.LineBasicMaterial({ color: '#a8e9dd' });
    const railMaterial = new THREE.MeshStandardMaterial({ color: '#a8b3b3', metalness: 0.7, roughness: 0.3 });
    const group = new THREE.Group();
    group.rotation.y = azimuth;
    group.rotation.z = -THREE.MathUtils.degToRad(number(form.azimuth, 180) - 180) * 0.12;
    for (let index = 0; index < count; index += 1) {
      const column = index % columns; const row = Math.floor(index / columns);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.08, panelD, 2, 1, 2), panelMaterial);
      panel.position.set((column - (columns - 1) / 2) * (panelW + gap), height + row * (panelD + rowSpacing), 0);
      panel.rotation.x = -tilt; panel.castShadow = true; panel.receiveShadow = true; group.add(panel);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), frameMaterial); edges.position.copy(panel.position); edges.rotation.copy(panel.rotation); group.add(edges);
    }
    for (let row = 0; row < rows; row += 1) { const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.min(roofLength * 0.9, columns * (panelW + gap)), 0.05, 0.08), railMaterial); rail.position.set(0, height - 0.05 + row * (panelD + rowSpacing), -panelD / 2); rail.rotation.x = -tilt; group.add(rail); }
    group.position.set(installX, mappedRoofHeight + 0.12, installZ); group.rotation.x = tilt; plant.add(group);
    const inverter = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.35), new THREE.MeshStandardMaterial({ color: '#e1ba5e', roughness: 0.5 }));
    inverter.position.set(installX + effectiveRoofLength * 0.34, mappedRoofHeight + 0.5, installZ + effectiveRoofWidth * 0.32); inverter.castShadow = true; plant.add(inverter);
    const inverterLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.18), new THREE.MeshBasicMaterial({ color: '#26311f' })); inverterLabel.position.set(inverter.position.x, inverter.position.y + 0.05, inverter.position.z - 0.19); inverterLabel.rotation.x = -Math.PI / 2; plant.add(inverterLabel);
  }, [form, count, localSiteContext]);
  const resetCamera = () => { if (!cameraRef.current || !controlsRef.current) return; cameraRef.current.position.set(11, 9, 14); controlsRef.current.target.set(0, 0, 0); controlsRef.current.update(); };
  const position = solarPosition(number(form.latitude, 21.333), SEASON_PRESETS[season].day, hour);
  const seasonalRows = Object.keys(SEASON_PRESETS).map((name) => ({ name, generation: seasonalGeneration(form, name) }));
  return <div className="quotation-3d-wrap quotation-real-3d" ref={previewRef}>
    <div className="quotation-3d-toolbar"><div><strong>{localSiteContext?.buildings?.length ? 'Mapped solar site simulator' : 'Solar site simulator'}</strong><small>{form.roofSurface || 'Flat RCC roof'} · {form.panelLayout || 'Portrait'} modules · {count} panels{localSiteContext?.buildings?.length ? ' · OpenStreetMap building context' : ' · Manual roof context'}</small></div><div className="inline-actions"><button type="button" className="btn secondary" onClick={resetCamera}>Reset view</button><button type="button" className="btn secondary" onClick={toggleFullscreen}>Full screen</button></div></div>
    <div className="quotation-3d-scene" ref={sceneRef} />
    <div className="solar-simulator-controls"><label>Season<select value={season} onChange={(event) => setSeason(event.target.value)}>{Object.entries(SEASON_PRESETS).map(([name, preset]) => <option key={name} value={name}>{name} · {preset.label}</option>)}</select></label><label>Sun time <strong>{String(hour).padStart(2, '0')}:00</strong><input type="range" min="6" max="18" step="1" value={hour} onChange={(event) => setHour(Number(event.target.value))} /></label><div className="solar-position-readout"><span>Sun altitude <strong>{Math.max(0, position.altitude).toFixed(1)}°</strong></span><span>Solar azimuth <strong>{position.azimuth.toFixed(0)}°</strong></span></div></div>
    <div className="solar-season-grid">{seasonalRows.map((row) => <div key={row.name} className={row.name === season ? 'active' : ''}><span>{row.name}</span><strong>{Math.round(row.generation).toLocaleString('en-IN')}</strong><small>kWh / month</small></div>)}</div>
    <div className="quotation-3d-caption">Installation coordinate: {number(form.latitude).toFixed(6)}, {number(form.longitude).toFixed(6)} · The yellow marker is the exact array origin. {localSiteContext?.buildings?.length ? 'Mapped building footprints set the roof elevation and usable scale.' : 'Aerial imagery or mapped buildings were unavailable, so the roof remains editable.'} Generation is an engineering estimate and must be confirmed with roof measurements, shading survey, and commissioning data.</div>
  </div>;
}

export default function QuotationCenter({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({ ...initialForm, ...(location.state?.customer || {}) }));
  const [quotes, setQuotes] = useState([]);
  const [activeQuoteId, setActiveQuoteId] = useState(null);
  const [view, setView] = useState('dashboard');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);
  const [climate, setClimate] = useState([]);
  const [toolLoading, setToolLoading] = useState(false);
  const [calculator, setCalculator] = useState({ monthlyBill: '3000', tariff: '5', sunHours: '5', loss: '14', projectCost: '325000', subsidy: '78000', selfUse: '90', exportTariff: '5', escalation: '3', degradation: '0.5' });
  const [settings, setSettings] = useState({ companyName: user.shopName || 'SGSE Billing', gstNumber: user.shopGSTIN || '', tagline: 'Solar EPC design, supply and installation', about: '', defaultTariff: 5, defaultValidity: 15, panelBrands: ['Waaree', 'Adani', 'Vikram', 'Havells'], inverterBrands: ['Growatt', 'Sungrow', 'Waaree', 'Havells'] });
  const result = useMemo(() => calculate(form), [form]);
  const activeCustomerLead = location.state?.customer;

  const loadQuotes = async () => {
    try { const response = await api.get('/quotations', { headers: { Authorization: `Bearer ${getToken()}` } }); setQuotes(response.data || []); }
    catch (error) { setMessage(error.response?.data?.message || 'Unable to load quotations'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadQuotes(); }, []);
  useEffect(() => { api.get('/quotations/settings', { headers: { Authorization: `Bearer ${getToken()}` } }).then((response) => setSettings((current) => ({ ...current, ...(response.data || {}) }))).catch(() => {}); }, []);
  useEffect(() => {
    if (!location.state?.customer) return;
    setForm((current) => ({ ...current, ...location.state.customer }));
    setView('builder');
    setMessage(`Quotation draft ready for ${location.state.customer.clientName || 'this customer'}`);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const saveQuote = async (event) => {
    event?.preventDefault();
    if (!form.clientName.trim()) { setMessage('Add a client name before saving the quotation'); return; }
    try {
      const payload = { ...form, calculations: result, companyName: user.shopName || 'SGSE Billing' };
      const response = activeQuoteId
        ? await api.put(`/quotations/${activeQuoteId}`, payload, { headers: { Authorization: `Bearer ${getToken()}` } })
        : await api.post('/quotations', payload, { headers: { Authorization: `Bearer ${getToken()}` } });
      setQuotes((current) => activeQuoteId ? current.map((quote) => quote.id === activeQuoteId ? response.data : quote) : [response.data, ...current]);
      setActiveQuoteId(response.data.id); setMessage('Quotation saved to the workspace'); setView('history');
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to save quotation'); }
  };
  const openQuote = (quote) => { setForm({ ...initialForm, ...(quote.data || quote) }); setActiveQuoteId(quote.id); setView('builder'); setMessage(`Editing ${quote.quoteNumber}`); };
  const deleteQuote = async (quote) => {
    if (!window.confirm(`Delete ${quote.quoteNumber}?`)) return;
    try { await api.delete(`/quotations/${quote.id}`, { headers: { Authorization: `Bearer ${getToken()}` } }); setQuotes((current) => current.filter((item) => item.id !== quote.id)); setMessage('Quotation deleted'); }
    catch (error) { setMessage(error.response?.data?.message || 'Unable to delete quotation'); }
  };
  const newQuote = () => { setForm({ ...initialForm }); setActiveQuoteId(null); setView('builder'); setMessage('New quotation ready'); };
  const downloadPdf = () => {
    const canvas = document.querySelector('.quotation-real-3d canvas');
    const designImage = canvas?.toDataURL('image/png') || '';
    downloadQuotationPdf({ form, result, user, designImage, quoteNumber: quotes.find((quote) => quote.id === activeQuoteId)?.quoteNumber || 'Draft' });
  };
  const updateCalculator = (field, value) => setCalculator((current) => ({ ...current, [field]: value }));
  const calculatorResult = useMemo(() => {
    const bill = number(calculator.monthlyBill); const tariff = number(calculator.tariff, 5); const annualUse = tariff ? bill * 12 / tariff : 0;
    const performance = Math.max(0.1, 1 - clamp(calculator.loss, 0, 90) / 100); const sunHours = clamp(calculator.sunHours, 0.1, 12); const size = annualUse / (sunHours * 365 * performance);
    const generation = size * sunHours * 365 * performance; const selfUse = clamp(calculator.selfUse, 0, 100) / 100;
    const value = generation * (selfUse * tariff + (1 - selfUse) * number(calculator.exportTariff, 5)); const net = Math.max(0, number(calculator.projectCost) - number(calculator.subsidy));
    const rows = []; let cumulative = 0; const degradation = clamp(calculator.degradation, 0, 10) / 100; const escalation = clamp(calculator.escalation, 0, 30) / 100; for (let year = 1; year <= 25; year += 1) { const generated = generation * ((1 - degradation) ** (year - 1)); const yearValue = generated * tariff * ((1 + escalation) ** (year - 1)); cumulative += yearValue; rows.push({ year, generated, yearValue, cumulative }); }
    return { size, generation, value, payback: net / Math.max(value, 1), rows };
  }, [calculator]);
  const loadWeather = async () => {
    setToolLoading(true);
    try { const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${form.latitude}&longitude=${form.longitude}&current=temperature_2m,wind_speed_10m,precipitation&hourly=shortwave_radiation&forecast_days=1`); const data = await response.json(); setWeather({ temperature: data.current?.temperature_2m, wind: data.current?.wind_speed_10m, rain: data.current?.precipitation, solar: (data.hourly?.shortwave_radiation || []).reduce((sum, value) => sum + value, 0) / Math.max(1, (data.hourly?.shortwave_radiation || []).length) }); } catch { setMessage('Weather data could not be loaded'); } finally { setToolLoading(false); }
  };
  const geocodeSite = async () => {
    if (!form.siteName.trim()) return;
    setToolLoading(true);
    try { const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(form.siteName)}`, { headers: { 'Accept-Language': 'en' } }); const data = await response.json(); if (!data.length) throw new Error('not found'); update('latitude', Number(data[0].lat).toFixed(6)); update('longitude', Number(data[0].lon).toFixed(6)); setMessage(`Coordinates found for ${data[0].display_name}`); } catch { setMessage('Location not found. Enter coordinates manually.'); } finally { setToolLoading(false); }
  };
  const loadClimate = async () => {
    setToolLoading(true);
    try { const end = new Date().getFullYear() - 1; const start = end - 24; const response = await fetch(`https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${form.longitude}&latitude=${form.latitude}&start=${start}&end=${end}&format=JSON`); const data = await response.json(); const values = data.properties.parameter.ALLSKY_SFC_SW_DWN || {}; const averages = months.map((_, index) => { const entries = Object.entries(values).filter(([key]) => Number(key.slice(4, 6)) - 1 === index).map(([, value]) => Number(value)); return entries.length ? entries.reduce((sum, value) => sum + value, 0) / entries.length : 0; }); const validAverages = averages.filter((value) => value > 0); const siteAverage = validAverages.length ? validAverages.reduce((sum, value) => sum + value, 0) / validAverages.length : 5.2; setClimate(averages); update('solarResource', siteAverage.toFixed(2)); setMessage(`NASA POWER climate loaded for ${start}-${end}; generation now uses ${siteAverage.toFixed(2)} kWh/m²/day`); } catch { setMessage('Climate data could not be loaded'); } finally { setToolLoading(false); }
  };
  const saveSettings = async (event) => { event.preventDefault(); try { const response = await api.put('/quotations/settings', settings, { headers: { Authorization: `Bearer ${getToken()}` } }); setSettings(response.data); setMessage('Quotation center settings saved'); } catch (error) { setMessage(error.response?.data?.message || 'Unable to save quotation settings'); } };

  return <div className="quotation-page">
    <div className="page-header quotation-header"><div><p className="eyebrow">Solar EPC workspace</p><h3>3D quotation center</h3><p className="muted">Design, calculate, and manage client-ready solar proposals with your shop data.</p></div><div className="inline-actions"><button className="btn outline" type="button" onClick={() => setView('history')}>Quotation history ({quotes.length})</button><button className="btn primary" type="button" onClick={newQuote}>New quotation</button></div></div>
    {message && <p className="status-message">{message}</p>}
    {activeCustomerLead && <div className="customer-quote-banner"><div><span className="eyebrow small">Customer handoff</span><strong>{activeCustomerLead.clientName || 'Customer brief'}</strong><small>{activeCustomerLead.siteName || 'Solar project'} · {activeCustomerLead.capacity || '5'} kW</small></div><button className="btn primary" type="button" onClick={() => setView('builder')}>Continue builder</button></div>}
    <button type="button" className={`quotation-dashboard-button ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>Dashboard</button>
    {view === 'dashboard' && <section className="quotation-dashboard"><div className="panel quotation-hero"><div><span className="quotation-badge">SUN-POWERED EPC WORKFLOW</span><h4>Design. Calculate. Propose. Close.</h4><p className="muted">Build a client-ready solar EPC proposal with site data, manual 3D design, generation, finance, subsidy, ROI, and equipment selection.</p></div><div className="quotation-current-site"><span>Current site</span><strong>{form.siteName || 'Bargarh, Odisha'}</strong><small>{form.latitude}, {form.longitude}</small></div></div><div className="quotation-tool-kpis quotation-dashboard-kpis"><div><span>System size</span><strong>{result.capacity.toFixed(2)} kW</strong><small>editable EPC capacity</small></div><div><span>Annual generation</span><strong>{Math.round(result.annualGeneration).toLocaleString('en-IN')} kWh</strong><small>site-based estimate</small></div><div><span>Annual bill saving</span><strong>{money(result.annualValue)}</strong><small>at current tariff</small></div><div><span>Payback</span><strong>{result.payback.toFixed(1)} years</strong><small>simple payback</small></div></div><div className="quotation-dashboard-grid"><section className="panel"><div className="panel-header"><div><h4>Generation profile</h4><p className="muted">Current manual design estimate.</p></div><button className="btn outline" type="button" onClick={() => setView('builder')}>Open 3D design</button></div><div className="quotation-month-bars">{months.map((month, index) => <div key={month}><span style={{ height: `${35 + ((index * 17) % 55)}%` }} /><small>{month}</small></div>)}</div></section><section className="panel"><div className="panel-header"><div><h4>Last quotation</h4><p className="muted">Continue from saved work.</p></div><button className="btn outline" type="button" onClick={() => setView('history')}>Open history</button></div>{quotes[0] ? <div className="quotation-last-quote"><strong>{quotes[0].quoteNumber}</strong><span>{quotes[0].clientName}</span><b>{money(quotes[0].calculations?.cost || quotes[0].data?.projectCost)}</b><small>{formatDate(quotes[0].updatedAt || quotes[0].createdAt)}</small><button className="btn primary" type="button" onClick={() => openQuote(quotes[0])}>Continue proposal</button></div> : <div className="quotation-last-quote"><strong>No saved quotations</strong><span>Start with a manual solar project.</span><button className="btn primary" type="button" onClick={newQuote}>Create quotation</button></div>}</section></div></section>}
    <div className="quotation-tabs"><button type="button" className={view === 'builder' ? 'active' : ''} onClick={() => setView('builder')}>3D setup</button><button type="button" className={view === 'site' ? 'active' : ''} onClick={() => setView('site')}>Site + weather</button><button type="button" className={view === 'calculator' ? 'active' : ''} onClick={() => setView('calculator')}>Solar calculator</button><button type="button" className={view === 'proposal' ? 'active' : ''} onClick={() => setView('proposal')}>Proposal</button><button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>Quotations</button><button type="button" className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>Settings</button></div>
    {view === 'site' && <section className="panel quotation-tool-panel"><div className="panel-header"><div><h4>Site, coordinates, and weather</h4><p className="muted">Use a location lookup or edit coordinates manually for the project site.</p></div></div><div className="form-grid"><label>Site / client location<input value={form.siteName} onChange={(event) => update('siteName', event.target.value)} /></label><label>Tariff (INR / kWh)<input type="number" value={form.tariff} onChange={(event) => update('tariff', event.target.value)} /></label><label>Latitude<input type="number" step="0.000001" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} /></label><label>Longitude<input type="number" step="0.000001" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} /></label></div><div className="inline-actions quotation-tool-actions"><button type="button" className="btn primary" onClick={geocodeSite} disabled={toolLoading}>Find coordinates</button><button type="button" className="btn outline" onClick={loadWeather} disabled={toolLoading}>Load weather</button><a className="btn outline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`}>Open Google Maps</a></div>{weather && <div className="quotation-tool-kpis"><div><span>Temperature</span><strong>{weather.temperature ?? '-'}°C</strong></div><div><span>Rain</span><strong>{weather.rain ?? '-'} mm</strong></div><div><span>Wind</span><strong>{weather.wind ?? '-'} km/h</strong></div><div><span>Solar resource</span><strong>{Math.round(weather.solar || 0)} W/m²</strong></div></div>}<div className="panel-header quotation-climate-heading"><div><h4>25-year solar climate</h4><p className="muted">NASA POWER monthly resource averages for the selected coordinates.</p></div><button type="button" className="btn outline" onClick={loadClimate} disabled={toolLoading}>Load NASA POWER</button></div>{climate.length > 0 && <div className="quotation-climate-bars">{climate.map((value, index) => <div key={months[index]}><span style={{ height: `${Math.max(8, Math.min(100, value * 12))}%` }} /><small>{months[index]}</small><b>{value.toFixed(1)}</b></div>)}</div>}</section>}
    {view === 'calculator' && <section className="panel quotation-tool-panel"><div className="panel-header"><div><h4>Solar calculator and 25-year ROI</h4><p className="muted">Estimate recommended capacity, annual value, payback, escalation, and degradation.</p></div><button type="button" className="btn outline" onClick={() => setCalculator({ monthlyBill: '3000', tariff: '5', sunHours: '5', loss: '14', projectCost: '325000', subsidy: '78000', selfUse: '90', exportTariff: '5', escalation: '3', degradation: '0.5' })}>Reset defaults</button></div><div className="form-grid">{[['monthlyBill','Monthly bill'],['tariff','Tariff (INR/kWh)'],['sunHours','Sun hours/day'],['loss','System loss / PR (%)'],['projectCost','Project cost (INR)'],['subsidy','Subsidy (INR)'],['selfUse','Self consumption (%)'],['exportTariff','Export credit (INR/kWh)'],['escalation','Tariff escalation (%)'],['degradation','Panel degradation (%/year)']].map(([field, label]) => <label key={field}>{label}<input type="number" min="0" step="0.1" value={calculator[field]} onChange={(event) => updateCalculator(field, event.target.value)} /></label>)}</div><div className="quotation-tool-kpis"><div><span>Recommended size</span><strong>{calculatorResult.size.toFixed(2)} kW</strong></div><div><span>Annual generation</span><strong>{Math.round(calculatorResult.generation).toLocaleString('en-IN')} kWh</strong></div><div><span>Annual value</span><strong>{money(calculatorResult.value)}</strong></div><div><span>Simple payback</span><strong>{calculatorResult.payback.toFixed(1)} years</strong></div></div><div className="table-scroll"><table className="table"><thead><tr><th>Year</th><th>Generation</th><th>Annual value</th><th>Cumulative value</th></tr></thead><tbody>{calculatorResult.rows.map((row) => <tr key={row.year}><td>{row.year}</td><td>{Math.round(row.generated).toLocaleString('en-IN')} kWh</td><td>{money(row.yearValue)}</td><td>{money(row.cumulative)}</td></tr>)}</tbody></table></div></section>}
    {view === 'settings' && <form className="panel quotation-tool-panel" onSubmit={saveSettings}><div className="panel-header"><div><h4>Quotation company settings</h4><p className="muted">These defaults are stored with your authenticated account.</p></div><button className="btn primary" type="submit">Save settings</button></div><div className="form-grid"><label>Company name<input value={settings.companyName} onChange={(event) => setSettings({ ...settings, companyName: event.target.value })} /></label><label>GST number<input value={settings.gstNumber} onChange={(event) => setSettings({ ...settings, gstNumber: event.target.value })} /></label><label>Tagline<input value={settings.tagline} onChange={(event) => setSettings({ ...settings, tagline: event.target.value })} /></label><label>Default tariff<input type="number" value={settings.defaultTariff} onChange={(event) => setSettings({ ...settings, defaultTariff: event.target.value })} /></label><label>Quotation validity (days)<input type="number" min="1" value={settings.defaultValidity} onChange={(event) => setSettings({ ...settings, defaultValidity: event.target.value })} /></label><label className="span-full">About company<textarea value={settings.about} onChange={(event) => setSettings({ ...settings, about: event.target.value })} /></label><label className="span-full">Panel brands, comma separated<input value={(settings.panelBrands || []).join(', ')} onChange={(event) => setSettings({ ...settings, panelBrands: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label><label className="span-full">Inverter brands, comma separated<input value={(settings.inverterBrands || []).join(', ')} onChange={(event) => setSettings({ ...settings, inverterBrands: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label></div></form>}
    {view === 'history' ? <section className="panel quotation-history"><div className="panel-header"><div><h4>Saved quotations</h4><p className="muted">Stored securely for this shop account.</p></div><button type="button" className="btn primary" onClick={newQuote}>Create quotation</button></div>{loading ? <LoadingState label="Loading saved quotations" /> : quotes.length ? <div className="quotation-history-list">{quotes.map((quote) => <div className="quotation-history-row" key={quote.id}><div><strong>{quote.quoteNumber}</strong><span>{quote.clientName} · {quote.data?.capacity || quote.capacity || 0} kW · {quote.data?.systemType || quote.systemType || 'On-grid'}</span></div><div><strong>{money(quote.calculations?.cost || quote.data?.projectCost || quote.projectCost)}</strong><span>{formatDate(quote.updatedAt || quote.createdAt)}</span></div><div className="inline-actions"><button type="button" className="btn outline" onClick={() => openQuote(quote)}>Open</button><button type="button" className="btn danger" onClick={() => deleteQuote(quote)}>Delete</button></div></div>)}</div> : <p className="empty-state">No quotations saved yet.</p>}</section> : <form className={`quotation-layout ${view === 'builder' || view === 'proposal' ? '' : 'quotation-layout-hidden'}`} onSubmit={saveQuote}>
      <div className="quotation-main"><section className="panel"><div className="panel-header"><div><h4>Client and site</h4><p className="muted">The proposal will use these details.</p></div><span className="quotation-number">{activeQuoteId ? 'Editing saved quote' : 'Draft quotation'}</span></div><div className="form-grid"><label>Client / firm name<input required value={form.clientName} onChange={(event) => update('clientName', event.target.value)} /></label><label>Contact number<input value={form.clientContact} onChange={(event) => update('clientContact', event.target.value)} /></label><label>Email<input type="email" value={form.clientEmail} onChange={(event) => update('clientEmail', event.target.value)} /></label><label>Site / location<input value={form.siteName} onChange={(event) => update('siteName', event.target.value)} /></label><label className="span-full">Site address<textarea rows="2" value={form.clientAddress} onChange={(event) => update('clientAddress', event.target.value)} /></label><label>Latitude<input type="number" step="0.000001" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} /></label><label>Longitude<input type="number" step="0.000001" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} /></label></div></section>
        <section className="panel"><div className="panel-header"><div><h4>3D EPC design</h4><p className="muted">Adjust the roof concept, layout, orientation, and equipment manually.</p></div></div><div className="form-grid"><label>Segment<select value={form.segment} onChange={(event) => update('segment', event.target.value)}><option>Residential</option><option>Commercial</option><option>Industrial</option><option>MW Project</option></select></label><label>System type<select value={form.systemType} onChange={(event) => update('systemType', event.target.value)}><option>On-grid</option><option>Hybrid Without Battery</option><option>Hybrid With Battery</option><option>Off-grid</option></select></label><label>Capacity (kW)<input type="number" min="0.5" step="0.5" value={form.capacity} onChange={(event) => update('capacity', event.target.value)} /></label><label>Panel count<input type="number" min="1" max="36" value={form.panelCount} onChange={(event) => update('panelCount', event.target.value)} /></label><label>Panel wattage (W)<input type="number" min="100" value={form.panelWattage} onChange={(event) => update('panelWattage', event.target.value)} /></label><label>Roof length (m)<input type="number" min="1" step="0.1" value={form.roofLength} onChange={(event) => update('roofLength', event.target.value)} /></label><label>Roof width (m)<input type="number" min="1" step="0.1" value={form.roofWidth} onChange={(event) => update('roofWidth', event.target.value)} /></label><label>Roof surface<select value={form.roofSurface} onChange={(event) => update('roofSurface', event.target.value)}><option>Flat RCC roof</option><option>Metal sheet roof</option><option>Tile roof</option><option>Concrete slab</option></select></label><label>Panel layout<select value={form.panelLayout} onChange={(event) => update('panelLayout', event.target.value)}><option>Portrait</option><option>Landscape</option></select></label><label>Panel gap (m)<input type="number" min="0.01" step="0.01" value={form.panelGap} onChange={(event) => update('panelGap', event.target.value)} /></label><label>Row spacing (m)<input type="number" min="0.2" step="0.05" value={form.rowSpacing} onChange={(event) => update('rowSpacing', event.target.value)} /></label><label>Mounting height (m)<input type="number" min="0.1" step="0.05" value={form.mountingHeight} onChange={(event) => update('mountingHeight', event.target.value)} /></label><label>Tilt (degrees)<input type="number" min="0" max="45" value={form.tilt} onChange={(event) => update('tilt', event.target.value)} /></label><label>Azimuth (degrees)<input type="number" min="0" max="360" value={form.azimuth} onChange={(event) => update('azimuth', event.target.value)} /></label><label>Shading factor (%)<input type="number" min="0" max="100" value={form.shading} onChange={(event) => update('shading', event.target.value)} /></label><label>Panel brand<select value={form.panelBrand} onChange={(event) => update('panelBrand', event.target.value)}><option>Waaree</option><option>Adani</option><option>Vikram</option><option>Havells</option></select></label><label>Inverter brand<select value={form.inverterBrand} onChange={(event) => update('inverterBrand', event.target.value)}><option>Growatt</option><option>Sungrow</option><option>Waaree</option><option>Havells</option></select></label><label>Battery type<select value={form.batteryType} onChange={(event) => update('batteryType', event.target.value)}><option>None</option><option>Lead Acid</option><option>Lithium</option></select></label><label>Battery capacity (kWh)<input type="number" min="0" step="0.5" value={form.batteryKwh} onChange={(event) => update('batteryKwh', event.target.value)} /></label></div><ThreeDPreview form={form} /></section>
        <section className="panel"><div className="panel-header"><div><h4>Commercials and finance</h4><p className="muted">Use editable assumptions before issuing a proposal.</p></div></div><div className="form-grid"><label>Tariff (INR / kWh)<input type="number" min="0" step="0.01" value={form.tariff} onChange={(event) => update('tariff', event.target.value)} /></label><label>Project cost (INR)<input type="number" min="0" value={form.projectCost} onChange={(event) => update('projectCost', event.target.value)} /></label><label>GST rate (%)<input type="number" min="0" step="0.1" value={form.gstRate} onChange={(event) => update('gstRate', event.target.value)} /></label><label>Central subsidy (INR)<input type="number" min="0" value={form.centralSubsidy} onChange={(event) => update('centralSubsidy', event.target.value)} /></label><label>State subsidy scenario (INR)<input type="number" min="0" value={form.stateSubsidy} onChange={(event) => update('stateSubsidy', event.target.value)} /></label><label>Finance percentage<input type="number" min="0" max="100" value={form.financePercent} onChange={(event) => update('financePercent', event.target.value)} /></label><label>Interest rate (%)<input type="number" min="0" step="0.1" value={form.interestRate} onChange={(event) => update('interestRate', event.target.value)} /></label><label>Tenure (years)<input type="number" min="1" value={form.tenureYears} onChange={(event) => update('tenureYears', event.target.value)} /></label><label className="span-full">Proposal notes<textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Warranty, approvals, installation assumptions..." /></label></div></section></div>
      <aside className="quotation-sidebar"><section className="panel quotation-summary"><div className="panel-header"><div><h4>Live estimate</h4><p className="muted">Scenario values update as you edit.</p></div></div><div className="quotation-kpis"><div><span>System size</span><strong>{result.capacity.toFixed(2)} kW</strong></div><div><span>Annual generation</span><strong>{Math.round(result.annualGeneration).toLocaleString('en-IN')} kWh</strong></div><div><span>Annual saving</span><strong>{money(result.annualValue)}</strong></div><div><span>Payback</span><strong>{result.payback.toFixed(1)} yrs</strong></div></div><div className="quotation-bars">{months.map((month, index) => <span key={month} title={`${month}: ${Math.round(result.annualGeneration / 12 * (0.75 + (index % 4) / 8)).toLocaleString('en-IN')} kWh`} style={{ height: `${35 + ((index * 17) % 55)}%` }} />)}</div><div className="quotation-finance"><span>Finance amount</span><strong>{money(result.financed)}</strong><span>Illustrative EMI</span><strong>{money(result.emi)} / month</strong><span>Subsidy scenario</span><strong>{money(result.subsidy)}</strong></div><button className="btn primary quotation-save" type="submit">{activeQuoteId ? 'Update quotation' : 'Save quotation'}</button><button className="btn secondary quotation-print" type="button" onClick={downloadPdf}>Download quotation PDF</button></section><section className="panel quotation-preview"><div className="panel-header"><div><h4>Client preview</h4><p className="muted">A compact review before saving.</p></div></div><div className="quotation-paper"><strong>{user.shopName || 'SGSE Billing'}</strong><h5>Solar EPC Proposal</h5><p>{form.clientName || 'Client name'} · {form.siteName || 'Site location'}</p><hr /><div><span>System</span><b>{result.capacity.toFixed(2)} kW {form.systemType}</b></div><div><span>Equipment</span><b>{form.panelBrand} / {form.inverterBrand}</b></div><div><span>Project cost</span><b>{money(result.cost)}</b></div><div><span>Annual generation</span><b>{Math.round(result.annualGeneration).toLocaleString('en-IN')} kWh</b></div><div><span>Validity</span><b>15 days</b></div></div></section></aside>
    </form>}
  </div>;
}
