class CreateHeros < ActiveRecord::Migration
  def change
    create_table :heros do |t|
      t.string :name
      t.text :reason

      t.timestamps
    end
  end
end
