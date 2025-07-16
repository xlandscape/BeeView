import h5wasm from "h5wasm";
const { FS } = await h5wasm.ready;

export async function loadNectarMaxValues() {
  await h5wasm.ready;

  // Load the HDF5 file (served from public/data/)
  const file = new h5wasm.File('./data/arr.dat', 'r');
  console.log(file.keys())
  // Access the BeeForage dataset
  const beeForageDataset = file.get('BeeForage/Nectar');
  const nectarData = await beeForageDataset.toArray(); // shape: [numFeatures, 365]

  // Compute max for each feature
  const maxNectar = nectarData.map(days => Math.max(...days));
  console.log('Max Nectar Values:', maxNectar);
  return maxNectar; // Array of max values, index matches GeoJSON feature order
}