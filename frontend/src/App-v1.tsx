// App.tsx
import { useEffect, useState } from "react";
// import { useWs } from "./useWs";
import { api } from "./api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SelectedNetwork = {
  ssid: string;
  rssi: number;
  ch: number;
  enc: "open" | "wpa2";
};
export default function App() {
  // const { connected, last, send } = useWs();
  // const [status, setStatus] = useState(null);
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedNetwork, setSelectedNetwork] =
    useState<SelectedNetwork | null>(null);
  const [password, setPassword] = useState("Olorede1309");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectedNetwork, setConnectedNetwork] =
    useState<SelectedNetwork | null>(null);
  // useEffect(() => {
  //   api
  //     .status()
  //     .then((s) => setStatus(s))
  //     .catch((e) => setStatus({ error: String(e) }));
  // }, []);

  // Capture Wiâ€‘Fi scan results from WS
  // useEffect(() => {
  //   if (!last) return;
  //   if ((last as any).type === "wifiList") {
  //     setWifi((last as any).list ?? []);
  //   }
  // }, [last]);

  useEffect(() => {
    handleWifiScan();
  }, []);
  useEffect(() => {
    // setPassword("");
    setIsConnecting(false);
  }, [isModalOpen]);
  async function handleWifiScan() {
    setIsLoadingNetworks(true);
    const res = await api.wifiScan();
    setIsLoadingNetworks(false);

    console.log(res);
    setAvailableNetworks(res.list);
  }
  async function handleWifiConnect() {
    if (!selectedNetwork) return;

    setIsConnecting(true);
    try {
      console.log("before api call: lkajsdfklsjklasdjfljfa");
      const res = await api.wifiConnect(selectedNetwork.ssid, password);

      setConnectedNetwork(selectedNetwork);
      console.log("after api call: lkajsdfklsjklasdjfljfa");
      console.log(res);
    } catch (error) {
      setConnectedNetwork(null);
      console.error(error);
    } finally {
      setIsConnecting(false);
    }
  }
  async function handleWifiDisconnect() {
    if (!selectedNetwork) return;

    setIsConnecting(true);
    try {
      console.log("before api call: lkajsdfklsjklasdjfljfa");
      const res = await api.wifiDisconnect();

      setConnectedNetwork(null);
      console.log("after api call: lkajsdfklsjklasdjfljfa");
      console.log(res);
    } catch (error) {
      console.error(error);
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 className="text-blue-500">ESP Control</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Button onClick={handleWifiScan}>Scan via HTTP</Button>
      </div>
      {isLoadingNetworks && <p>Loading...</p>}
      {availableNetworks.map((network: SelectedNetwork) => (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger
            onClick={() => setSelectedNetwork(network)}
            className="block w-full text-left border rounded-lg p-3 mb-3 cursor-pointer"
          >
            {network.enc !== "open" ? "ðŸ”’: " : "ðŸ”“: "}
            {network.ssid}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedNetwork?.ssid}</DialogTitle>
              <DialogDescription>{selectedNetwork?.enc}</DialogDescription>
            </DialogHeader>
            {network.enc !== "open" && (
              <div className="flex flex-col gap-1">
                <label>Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="text"
                  className="border p-2 rounded-md"
                  placeholder="123ksajfl837"
                />
              </div>
            )}
            {connectedNetwork && connectedNetwork === selectedNetwork ? (
              <Button
                disabled={
                  (!password || isConnecting) && selectedNetwork?.enc !== "open"
                }
                onClick={handleWifiDisconnect}
                className="disabled:opacity-30"
              >
                {isConnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            ) : (
              <Button
                disabled={
                  (!password || isConnecting) && selectedNetwork?.enc !== "open"
                }
                onClick={handleWifiConnect}
                className="disabled:opacity-30"
              >
                {isConnecting ? "Connecting..." : "Connect"}
              </Button>
            )}
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}

// {
//     "ssid": "Infinix HOT 40i",
//     "rssi": -85,
//     "ch": 1,
//     "enc": "wpa2"
//   },
