import { useEffect, useState } from "react";

// import { invoke } from "@tauri-apps/api/tauri";
import { NatsConnection, StringCodec, Subscription, connect } from "nats.ws";

import "./App.css";

interface RawHost {
  source: string;
  data: {
    friendly_name: string;
    uptime_seconds: string;
  }
}

interface Host {
  friendlyName: string;
  uptime: string;
}

function App() {
  const [nc, setNc] = useState<NatsConnection|null>(null);
  const [evtSub, setEvtSub] = useState<Subscription|null>(null);
  const [hosts, setHosts] = useState<Map<string, Host>>(new Map());

  const [topic, setTopic] = useState("");
  const [payload, setPayload] = useState("");
  const [response, setResponse] = useState("");

  const sc = StringCodec();

  useEffect(() => {
    (async () => {
      init();
    })();
  }, []);

  async function init() {
    console.log('init');
    try {
      const nc = await connect({ servers: "ws://127.0.0.1:2222" });
      setNc(nc);
      const sub = nc.subscribe("wasmbus.evt.>");
      setEvtSub(sub);
      processEvents(sub);
    } catch (err) {
      console.error('error connecting');
      console.error(err);
    }
  }

  async function processEvents(evtSub: Subscription) {
    if (evtSub) {
      let hosts2 = hosts; // IDK how to React
      for await (const message of evtSub) {
        const parsedEvent = JSON.parse(sc.decode(message.data));

        console.log('got event:', parsedEvent);

        const type = parsedEvent.type;
        if (type.startsWith('com.wasmcloud.lattice.host_')) {
          if (type.endsWith('host_stopped')) {
            hosts2.delete(parsedEvent.source);
          } else {
            hosts2.set(parsedEvent.source, {
              friendlyName: parsedEvent.data.friendly_name,
              uptime: parsedEvent.data.uptime_seconds,
            });
          }
          console.log('setting hosts', hosts2.keys());
          // debugger;
          setHosts(new Map(hosts2));
        }
      }
      console.log("evt subscription closed");
    } else {
      console.error('evtSub is null');
    }
  }

  function renderHosts() {
    return Array.from(hosts.values()).map((host, i) => {
      return renderHost(host, i);
    });
  }

  function renderHost(host: Host, i: number) {
    console.log(`rendering host ${i} ${host.friendlyName}`);
    return (
      <div key={i}>
        <p>Name: {host.friendlyName}</p>
        <p>Uptime: {host.uptime} seconds</p>
      </div>
    )
  }

  async function request(nc: NatsConnection, topic: string, payload: string) {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    try {
      let resp = await nc.request(topic, sc.encode(''));
      setResponse(sc.decode(resp.data));
    } catch(err: any) {
      console.error(`error sending request: `)
      console.error(err)
    } finally {
    }
  }

  return (
    <div className="container">
      <h1>Welcome to Teri's washboard POC!</h1>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          request(nc!, topic, payload);
        }}
      >
        <input
          id="topic-input"
          onChange={(e) => setTopic(e.currentTarget.value)}
          placeholder="Enter a topic..."
        />
        <input
          id="payload-input"
          onChange={(e) => setPayload(e.currentTarget.value)}
          placeholder="Enter a payload..."
        />
        <button type="submit">Send request</button>
      </form>

      <p>Response: {response}</p>
      <div>
        <h2>Hosts</h2>
        {Array.from(hosts.values()).map((host, i) => renderHost(host, i))}
      </div>
    </div>

  );
}

export default App;
