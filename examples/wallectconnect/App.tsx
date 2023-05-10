import { Web3Modal } from "@web3modal/standalone";
import { SignClient } from "@walletconnect/sign-client";
import { ProposalTypes, SessionTypes, ISignClient } from "@walletconnect/types";
import { useEffect, useState } from "react";

const PROJECT_ID = "a8240ea6d2f605470d2519e5d2e8c1c0";

const web3Modal = new Web3Modal({ projectId: PROJECT_ID, standaloneChains: ["ckbbip44:1"], walletConnectVersion: 2 });
const namespaces: ProposalTypes.RequiredNamespaces = {
  ckbbip44: {
    chains: ["ckbbip44:1"],
    methods: ["wallet_signData"],
    events: [],
  },
};

export function App() {
  const [client, setClient] = useState<ISignClient>();
  const [session, setSession] = useState<SessionTypes.Struct>();
  const [address, setAddress] = useState("");
  const [signature, setSignature] = useState("");

  useEffect(() => {
    (async () => {
      const signClient = await SignClient.init({
        projectId: PROJECT_ID,
      });

      const { uri, approval } = await signClient.connect({ requiredNamespaces: namespaces });
      await web3Modal.openModal({ uri });
      const session = await approval();
      alert("Approved with:" + session.namespaces.ckbbip44.accounts);
      setSession(session);
      setClient(signClient);
      setAddress(session.namespaces.ckbbip44.accounts[0]);
      web3Modal.closeModal();
    })();
  }, []);

  async function signData() {
    if (!session || !client) {
      return;
    }

    const result = await client.request({
      topic: session.topic,
      chainId: "ckbbip44:1",
      request: {
        method: "wallet_signData",
        params: [
          session.namespaces.ckbbip44.accounts[0],
          "0x68656c6c6f20776f726c6420e4bda0e5a5bde4b896e7958c20f09f918b",
        ],
      },
    });

    alert(JSON.stringify(result));
    setSignature(result as string);
  }

  return (
    <div>
      <h1>Neuron ❤️ WalletConnect</h1>
      <button type="button" onClick={signData}>
        wallet_signData
      </button>

      <pre>
        message: hello world 你好世界 👋
        <br />
        hex: 0x68656c6c6f20776f726c6420e4bda0e5a5bde4b896e7958c20f09f918b
      </pre>

      {address && <p>address: {address}</p>}
      {signature && <p>signature: {signature}</p>}
    </div>
  );
}
