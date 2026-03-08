import { useEffect, useState } from "react"
import { api } from "../api/api"

export default function Systems() {

  const [systems, setSystems] = useState<any[]>([])

  useEffect(() => {

    api.get("/systems/")
      .then(res => setSystems(res.data))

  }, [])

  return (

    <div style={{padding:20}}>

      <h2>Compute Systems</h2>

      {systems.map((system) => (

        <div
          key={system.id}
          style={{
            border: "1px solid gray",
            padding: 15,
            marginBottom: 10
          }}
        >

          <h3>{system.name}</h3>

          <p>CPU: {system.cpu_cores}</p>
          <p>GPU: {system.gpu_units}</p>
          <p>RAM: {system.ram_gb} GB</p>

          <button
            onClick={() => createBooking(system.id)}
          >
            Create Booking
          </button>

        </div>

      ))}

    </div>

  )
}


async function createBooking(systemId:number){

  try{

    const res = await api.post("/bookings/", {

      system_id: systemId,

      start_time: "2026-03-05T10:00:00",
      end_time: "2026-03-05T12:00:00",

      req_cpu: 4,
      req_gpu: 1,
      req_ram: 16,
      req_vram: 24,

      access_type: "BACKGROUND",

      academic_category: "Research",
      project_title: "RL Training",
      expected_deliverable: "Model",
      objective: "Train policy"
    })

    console.log(res.data)

    alert("Booking created!")

  }catch(err){

    console.error(err)

    alert("Booking failed. Check console.")

  }

}