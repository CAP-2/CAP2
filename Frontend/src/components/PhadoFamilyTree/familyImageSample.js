export const IMAGE_FAMILY_SAMPLE_DATA = {
  source: "Trich xuat tu phan anh gia pha da cung cap",
  note: "Du lieu chi gom cac thanh vien va quan he nhin thay ro trong anh mau.",
  people: [
    {
      id: "p-dan",
      full_name: "Phạm Văn Dần",
      gender: "male",
      status_text: "đã mất",
      generation: 1,
    },
    {
      id: "p-thich",
      full_name: "Phạm Thị Thích",
      gender: "female",
      status_text: "đã mất",
      generation: 1,
    },
    {
      id: "p-ngoi",
      full_name: "Đỗ Thị Ngợi",
      gender: "female",
      status_text: "đã mất",
      generation: 2,
    },
    {
      id: "p-bat",
      full_name: "Nguyễn Thị Bát",
      gender: "female",
      status_text: "đã mất",
      generation: 2,
    },
    {
      id: "p-dut",
      full_name: "Nguyễn Thị Dụt",
      gender: "female",
      status_text: "đã mất",
      generation: 2,
    },
  ],
  families: [
    {
      id: "f-dan-thich",
      father_id: "p-dan",
      mother_id: "p-thich",
    },
  ],
  children: [
    { id: "c-1", family_id: "f-dan-thich", person_id: "p-ngoi", sort_order: 1 },
    { id: "c-2", family_id: "f-dan-thich", person_id: "p-bat", sort_order: 2 },
    { id: "c-3", family_id: "f-dan-thich", person_id: "p-dut", sort_order: 3 },
  ],
};
